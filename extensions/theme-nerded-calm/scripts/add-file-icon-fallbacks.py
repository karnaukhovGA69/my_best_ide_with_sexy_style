"""Maintainer-only: make file icons independent of installed language grammars."""
import json
from pathlib import Path

extension = Path(__file__).resolve().parents[1]
root = extension.parent
icon_file = extension / 'fileicons/vscode-icons.json'
provenance_file = extension / 'fileicons/provenance.json'
icons = json.loads(icon_file.read_text())
provenance = json.loads(provenance_file.read_text())
fallbacks = provenance.setdefault('languageIndependentFallbacks', {'fileExtensions': {}, 'fileNames': {}})
for package_file in sorted(root.glob('*/package.json')):
    package = json.loads(package_file.read_text())
    contributions = package.get('contributes', {})
    grammar_languages = {item.get('language') for item in contributions.get('grammars', [])}
    for language in contributions.get('languages', []):
        if language['id'] not in grammar_languages:
            continue
        for variant in [icons, icons.get('light', {})]:
            icon = variant.get('languageIds', {}).get(language['id'])
            if not icon:
                continue
            for source_key, target_key in [('extensions', 'fileExtensions'), ('filenames', 'fileNames')]:
                target = variant.setdefault(target_key, {})
                existing = {key.casefold() for key in target}
                for name in language.get(source_key, []):
                    if source_key == 'extensions':
                        if not name.startswith('.'):
                            continue
                        name = name[1:]
                    name = name.lower()
                    if name.casefold() not in existing:
                        target[name] = icon
                        existing.add(name.casefold())
                        if variant is icons:
                            fallbacks[target_key][name] = icon
change = 'Add filename/extension fallbacks from local TextMate language declarations; preserve existing specific mappings and support files without installed language extensions.'
if change not in provenance['changes']:
    provenance['changes'].append(change)
icon_file.write_text(json.dumps(icons, ensure_ascii=False, indent='\t') + '\n')
provenance_file.write_text(json.dumps(provenance, ensure_ascii=False, indent='\t') + '\n')
print({key: len(value) for key, value in fallbacks.items()})
