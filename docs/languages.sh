#!/bin/bash

# Arrays for language names and corresponding codes
languages=("French" "Spanish" "Brazilian Portuguese" "Russian" "Vietnamese" "Turkish" "Japanese" "Italian" "Simplified Chinese")
codes=("fr" "es" "pt-br" "ru" "vi" "tr" "ja" "it" "zh-cn")

# Source of truth directory
source_dir="en"

# Create a new Summary in the root directory
echo "# Summary" > SUMMARY.md

# Ensure the `.gitbook` directory is present in the source
gitbook_dir="$source_dir/.gitbook"

# Sync each language with `en` directory
for i in "${!languages[@]}"; do
    lang="${languages[$i]}"
    lang_code="${codes[$i]}"

    echo "Syncing language: $lang_code with $source_dir..."

    # Create the language directory if it doesn't exist
    mkdir -p ./$lang_code

    # Sync files from the source (`en`) directory to each target language directory
    rsync -av --delete $source_dir/ $lang_code/

    # Add entry to the root SUMMARY.md for language selection
    echo "* [${lang}](./$lang_code/README.md)" >> SUMMARY.md

    echo "Directory for $lang_code synchronized with $source_dir."
done

echo "Multilingual structure synchronized, and root SUMMARY.md updated."
