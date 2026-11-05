/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');
const waitFor = async predicate => {
	const deadline = Date.now() + 10000;
	while (!predicate()) {
		if (Date.now() > deadline) { throw new Error('Native document condition timed out'); }
		await new Promise(resolve => setTimeout(resolve, 50));
	}
};
exports.run = async () => {
	const progress = async stage => { if (process.env.DOCUMENTS_NATIVE_RESULT) { await fs.writeFile(process.env.DOCUMENTS_NATIVE_RESULT, stage); } };
	await progress('started');
	const fixtureRoot = process.env.DOCUMENTS_NATIVE_FIXTURE || os.tmpdir();
	const folder = await fs.mkdtemp(path.join(fixtureRoot, 'myself-documents-test-'));
	try {
		await vscode.extensions.getExtension('myself.myself-documents').activate();
		await progress('activated');
		await vscode.commands.executeCommand('myself.documents.new');
		await progress('new-opened');
		await waitFor(() => vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom);
		const input = vscode.window.tabGroups.activeTabGroup.activeTab.input;
		assert.equal(input.viewType, 'myself.documents.editor');
		assert.equal(input.uri.scheme, 'untitled');
		await progress('new-verified');
		await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
		await progress('new-closed');
		const file = vscode.Uri.file(path.join(folder, 'Essay.txt'));
		await fs.writeFile(file.fsPath, 'а)1\r\n\r\nб)3', 'utf8');
		await vscode.commands.executeCommand('myself.documents.open', file);
		await waitFor(() => vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom);
		let document = await vscode.workspace.openTextDocument(file);
		const edit = new vscode.WorkspaceEdit();
		edit.insert(file, document.positionAt(document.getText().length), '\r\nEssay 😀');
		assert.equal(await vscode.workspace.applyEdit(edit), true);
		await vscode.commands.executeCommand('undo');
		assert.equal(document.getText(), 'а)1\r\n\r\nб)3');
		await vscode.commands.executeCommand('redo');
		assert.equal(document.getText(), 'а)1\r\n\r\nб)3\r\nEssay 😀');
		assert.equal(await document.save(), true);
		assert.equal(await fs.readFile(file.fsPath, 'utf8'), document.getText());
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		await vscode.commands.executeCommand('myself.documents.open', file);
		document = await vscode.workspace.openTextDocument(file);
		assert.equal(document.getText(), 'а)1\r\n\r\nб)3\r\nEssay 😀');
		await fs.writeFile(file.fsPath, 'External change\r\nСнаружи', 'utf8');
		await progress('waiting-for-external-change');
		try {
			await waitFor(() => { const current = vscode.workspace.textDocuments.find(d => d.uri.toString() === file.toString()); return current?.getText() === 'External change\r\nСнаружи'; });
		} catch (error) {
			await progress('external-change-timeout');
			throw error;
		}
		await vscode.commands.executeCommand('vscode.openWith', file, 'default');
		await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === file.toString());
		assert.equal(vscode.window.activeTextEditor.document.getText(), 'External change\r\nСнаружи');
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		// Save As resolves the untitled resource to a default text editor. The
		// document's Save handler must replace it without duplicating the tab,
		// even if another file became active while saving.
		await vscode.window.tabGroups.close(vscode.window.tabGroups.all.flatMap(group => group.tabs));
		await vscode.commands.executeCommand('vscode.openWith', file, 'default', { preview: false });
		const other = vscode.Uri.file(path.join(folder, 'Other.txt'));
		await fs.writeFile(other.fsPath, 'Keep this editor', 'utf8');
		await vscode.commands.executeCommand('vscode.openWith', other, 'default', { preview: false });
		await vscode.commands.executeCommand('reopenActiveEditorWith', 'myself.documents.editor', file);
		await waitFor(() => vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab =>
			tab.input instanceof vscode.TabInputCustom && tab.input.uri.toString() === file.toString()));
		const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
		const savedTabs = tabs.filter(tab => tab.input?.uri?.toString() === file.toString());
		assert.equal(savedTabs.length, 1);
		assert.equal(savedTabs[0].input.viewType, 'myself.documents.editor');
		assert.ok(tabs.some(tab => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === other.toString()));
		assert.equal(await fs.readFile(file.fsPath, 'utf8'), 'External change\r\nСнаружи');
		await progress('passed');
		console.log('DOCUMENTS_NATIVE_PASS: new/open/custom editor, real document undo/redo, CRLF save/reopen, external change, standard text editor');
	} finally {
		await fs.rm(folder, { recursive: true, force: true });
	}
};
