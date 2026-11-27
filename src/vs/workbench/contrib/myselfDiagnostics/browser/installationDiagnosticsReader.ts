/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isEqual } from '../../../../base/common/resources.js';
import { ILocalExtension } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { assessExtension, IExtensionActivationEvidence, IExtensionDiagnostic, selectedExtensions } from '../common/installationDiagnostics.js';

interface ILocalInventory extends Pick<IExtensionsWorkbenchService, 'whenInitialized' | 'onReset'> {
	readonly installed: readonly Pick<IExtensionsWorkbenchService['installed'][number], 'local'>[];
}

interface IDiagnosticsSnapshot {
	readonly profileName: string;
	readonly inventory: 'available' | 'unavailable' | 'profileChanged' | 'profileUnconfirmed';
	readonly extensions: readonly IExtensionDiagnostic[];
}

export class InstallationDiagnosticsReader extends Disposable {
	private profileRevision = 0;
	private profileSettled = true;
	private pendingInventoryResets = 0;
	private inventoryResetsOverlapped = false;

	constructor(
		private readonly profiles: Pick<IUserDataProfileService, 'currentProfile' | 'onDidChangeCurrentProfile'>,
		private readonly inventory: ILocalInventory,
		private readonly enablement: Pick<IWorkbenchExtensionEnablementService, 'isEnabled'>,
		private readonly runtime: Pick<IExtensionService, 'extensions' | 'getExtensionsStatus'>,
	) {
		super();
		this._register(this.profiles.onDidChangeCurrentProfile(event => {
			const revision = ++this.profileRevision;
			this.profileSettled = false;
			if (!isEqual(event.previous.extensionsResource, event.profile.extensionsResource)) {
				this.inventoryResetsOverlapped = this.pendingInventoryResets > 0;
				this.pendingInventoryResets++;
			}
			void event.whenSettled?.then(settled => {
				if (this.profileRevision === revision) {
					this.profileSettled = settled;
				}
			});
		}));
		this._register(this.inventory.onReset(() => {
			// The cache signals completion without identifying the profile it loaded.
			if (this.pendingInventoryResets > 0) {
				this.pendingInventoryResets--;
			}
		}));
	}

	async collect(): Promise<IDiagnosticsSnapshot> {
		const revision = this.profileRevision;
		const profileName = this.profiles.currentProfile.name;
		try {
			await this.inventory.whenInitialized;
			if (this.profileRevision !== revision) {
				return this.unavailable(this.profiles.currentProfile.name, 'profileChanged');
			}
			if (this.inventoryResetsOverlapped) {
				return this.unavailable(profileName, 'profileUnconfirmed');
			}
			if (!this.profileSettled || this.pendingInventoryResets > 0) {
				return this.unavailable(profileName, 'unavailable');
			}

			const installed = new Map<string, ILocalExtension>();
			for (const { local } of this.inventory.installed) {
				if (local?.location.scheme === Schemas.file && !local.isWorkspaceScoped) {
					installed.set(ExtensionIdentifier.toKey(local.identifier.id), local);
				}
			}
			const readActivation = this.readActivation();
			return {
				profileName,
				inventory: 'available',
				extensions: selectedExtensions.map(extension => {
					const local = installed.get(extension.id);
					if (!local) {
						return assessExtension(extension, 'notListed');
					}
					let enabled: boolean | undefined;
					try {
						enabled = this.enablement.isEnabled(local);
					} catch {
						// Preserve the installation and activation observations on enablement errors.
					}
					return assessExtension(extension, { enabled, activation: readActivation(local) });
				}),
			};
		} catch {
			return this.unavailable(this.profiles.currentProfile.name, this.profileRevision === revision ? 'unavailable' : 'profileChanged');
		}
	}

	private unavailable(profileName: string, inventory: Exclude<IDiagnosticsSnapshot['inventory'], 'available'>): IDiagnosticsSnapshot {
		return { profileName, inventory, extensions: selectedExtensions.map(extension => assessExtension(extension, 'unavailable')) };
	}

	private readActivation(): (local: ILocalExtension) => IExtensionActivationEvidence | undefined {
		try {
			const descriptions = this.runtime.extensions;
			const statuses = new Map(Object.values(this.runtime.getExtensionsStatus()).map(status => [ExtensionIdentifier.toKey(status.id), status]));
			return local => {
				const description = descriptions.find(extension =>
					ExtensionIdentifier.equals(extension.identifier, local.identifier.id) &&
					extension.version === local.manifest.version &&
					isEqual(extension.extensionLocation, local.location)
				);
				const status = description && statuses.get(ExtensionIdentifier.toKey(description.identifier));
				if (status) {
					return { started: status.activationStarted, succeeded: status.activationTimes !== undefined };
				}
				return undefined;
			};
		} catch {
			return () => undefined;
		}
	}
}
