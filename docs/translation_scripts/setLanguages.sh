#!/bin/bash

csv_file="./languages.csv"
source_dir="../en"

# Function to check if the CSV file exists
check_csv_file() {
  if [[ ! -f "$csv_file" ]]; then
    echo "CSV file not found: $csv_file"
    exit 1
  fi
}

# Function to create the target directory if it doesn't exist
create_directory_if_not_exists() {
  local code=$1
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
}

# Function to sync files between the source and target directories
sync_files() {
  local code=$1
  echo "Syncing files from $source_dir to ../$code..."
  rsync -av --delete --exclude '*_strings.json' "$source_dir/" "../$code/"

  if [[ $? -eq 0 ]]; then
    echo "Sync completed for $code."
  else
    echo "Error: Sync failed for $code."
  fi
}

# Main function to process each language from the CSV
process_languages() {
  while IFS=, read -r language code; do
    if [[ "$language" == "Language" || -z "$language" || -z "$code" ]]; then
      continue
    fi

    echo "Processing language: $language, code: $code..."

    create_directory_if_not_exists "$code"
    sync_files "$code"
  done < "$csv_file"
}

# Main execution starts here
check_csv_file
process_languages

echo "Language synchronization completed."
