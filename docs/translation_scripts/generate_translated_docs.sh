#!/bin/bash

# CSV file path (adjust if necessary)
csv_file="./languages.csv"

# Check if the CSV file exists
if [[ ! -f "$csv_file" ]]; then
  echo "CSV file not found: $csv_file"
  exit 1
fi

# Iterate over the CSV rows
while IFS=, read -r language code; do
  # Skip the header row or any blank rows
  if [[ "$language" == "Language" || -z "$language" || -z "$code" ]]; then
    continue
  fi

  echo "Processing language: $language with code: $code"

  # Input key file (in the directory for the current language code)
  KEY_FILE="../$code/${code}_string.json"

  # Check if the KEY_FILE exists
  if [[ ! -f "$KEY_FILE" ]]; then
    echo "Error: Key file missing for $code in path $KEY_FILE"
    continue
  fi

  # Iterate over all markdown (.md) files in the "keys_backup" directory
  find ../keys_backup -type f -name "*.md" | while read -r FILE; do
    # Get the relative path of the file to maintain structure
    relative_path=$(realpath --relative-to="../keys" "$FILE")

    # Path to generate the corresponding file in the language's directory
    GENERATED_FILE="../$code/$relative_path"

    # Create the target directory if it doesn't exist
    mkdir -p "$(dirname "$GENERATED_FILE")"

    # Copy the original .md file to the target location
    cp "$FILE" "$GENERATED_FILE"

    # Read the keys_backup from the JSON and replace them in the copied markdown file
    jq -r 'to_entries[] | "\(.key) \(.value)"' "$KEY_FILE" | while IFS=" " read -r key value; do
      # Use sed to replace occurrences of the key with the value in the generated file
      sed -i "s/$key/$value/g" "$GENERATED_FILE"
    done
  done

done < "$csv_file"