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
		await progress('passed');
		console.log('DOCUMENTS_NATIVE_PASS: new/open/custom editor, real document undo/redo, CRLF save/reopen, external change, standard text editor');
	} finally {
		await fs.rm(folder, { recursive: true, force: true });
	}
};
