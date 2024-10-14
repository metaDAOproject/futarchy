#!/bin/bash

# This script ensures each language has the same files as the English directory
# CSV file path (adjust if necessary)
csv_file="./languages.csv"

# Source of truth directory (parent directory's "en" directory)
source_dir="../en"

# Check if the CSV file exists
if [[ ! -f "$csv_file" ]]; then
  echo "CSV file not found: $csv_file"
  exit 1
fi

# Read languages and codes from CSV
while IFS=, read -r language code; do
  # Skip the header row or any blank rows
  if [[ "$language" == "Language" || -z "$language" || -z "$code" ]]; then
    continue
  fi

  # Debugging: Print the current language and code being processed
  echo "Processing language: $language, code: $code..."

  # Check if the language directory exists
  if [[ ! -d "../$code" ]]; then
    echo "Directory for $code does not exist. Creating..."
    mkdir -p "../$code"
    if [[ $? -ne 0 ]]; then
      echo "Error: Failed to create directory ../$code"
      exit 1
    fi
    echo "Directory for $code created."
  else
    echo "Directory for $code already exists."
  fi

  # Sync files from the source (en) directory to each target language directory
  echo "Syncing files from $source_dir to ../$code..."
  rsync -av --delete "$source_dir/" "../$code/"

  # Check if rsync succeeded
  if [[ $? -eq 0 ]]; then
    echo "Sync completed for $code."
  else
    echo "Error: Sync failed for $code."
  fi
done < "$csv_file"

echo "Multilingual structure synchronization completed."