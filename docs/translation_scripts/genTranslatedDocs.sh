#!/bin/bash
set -e
set -o pipefail
set -x  # Enable debugging mode

# This script generates the translated md files from the keys and translation JSON files.

# CSV file path (adjust if necessary)
csv_file="./languages.csv"

# Function to check if the CSV file exists
check_csv_file() {
  local csv_file="$1"

  if [[ ! -f "$csv_file" ]]; then
    echo "CSV file not found: $csv_file"
    exit 1
  fi
}

# Function to process the entire CSV file and iterate through each row
process_csv_file() {
  local csv_file="$1"
  local keys_dir="$2"

  # Iterate over the CSV rows
  while IFS=, read -r language code; do
    # Remove potential carriage return characters and trim whitespace
    language=$(echo "$language" | tr -d '\r' | xargs)
    code=$(echo "$code" | tr -d '\r' | xargs)

    # Skip header or empty lines
    if [[ "$language" == "Language" || -z "$language" || -z "$code" ]]; then
      continue
    fi

    process_language "$language" "$code" "$csv_file" "$keys_dir"
  done < "$csv_file"
}

# Function to process each language
process_language() {
  local language="$1"
  local code="$2"
  local csv_file="$3"
  local keys_dir="$4"

  echo "Processing language: '$language' with code: '$code'"

  # Input key file (in the directory for the current language code)
  local key_file="../$code/${code}_strings.json"
  echo "Key file path: '$key_file'"

  # Check if the key_file exists
  if [[ ! -f "$key_file" ]]; then
    echo "Error: Key file missing for $code in path $key_file"
    return
  fi

  # Process each markdown file for the current language
  find "$keys_dir" -type f -name "*.md" | while read -r file; do
    process_markdown_file "$file" "$code" "$key_file"
  done

  # After generating the files, check for lines containing {{
  check_for_placeholders "$code"
}

# Function to process a single markdown file
process_markdown_file() {
  local file="$1"
  local code="$2"
  local key_file="$3"

  # Get relative path by removing the known prefix
  local relative_path="${file#../keys/}"

  # Path to generate the corresponding file in the language's directory
  local generated_file="../$code/$relative_path"

  # Create the target directory if it doesn't exist
  mkdir -p "$(dirname "$generated_file")"

  # Copy the original .md file to the target location
  cp "$file" "$generated_file"

  # Substitute keys in the file
  substitute_keys_in_file "$generated_file" "$key_file"
}

# Function to substitute keys in a file
substitute_keys_in_file() {
  local generated_file="$1"
  local key_file="$2"

  # Read the keys from the JSON and replace them in the copied markdown file
  jq -r 'to_entries[] | "\(.key)\t\(.value | if type=="object" then .full_text else . end)"' "$key_file" | \
  while IFS=$'\t' read -r key value; do
    # Escape special characters in key and value
    local escaped_key
    escaped_key=$(printf '%s\n' "$key" | sed 's/[|\/&{}]/\\&/g')
    local escaped_value
    escaped_value=$(printf '%s\n' "$value" | sed 's/[|\/&]/\\&/g')

    # Construct the search pattern with braces
    local search_pattern="{{${escaped_key}}}"

    # Print key, value, and search pattern for debugging
    echo "Processing file: $generated_file"
    echo "Key: '$key'"
    echo "Value: '$value'"
    echo "Escaped Key: '$escaped_key'"
    echo "Escaped Value: '$escaped_value'"
    echo "Search Pattern: '$search_pattern'"

    # Check for empty key or value
    if [[ -z "$key" || -z "$value" ]]; then
      echo "Warning: Empty key or value encountered, skipping this substitution."
      continue
    fi

    # Replace the key with the value in the markdown file
    # Use the appropriate sed syntax for macOS (BSD sed)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|$search_pattern|$escaped_value|g" "$generated_file"
    else
      sed -i "s|$search_pattern|$escaped_value|g" "$generated_file"
    fi
  done
}

# Function to check for leftover placeholders
check_for_placeholders() {
  local code="$1"
  find "../$code" -type f -name "*.md" | while read -r generated_file; do
    if grep -q "{{" "$generated_file"; then
      echo "Error: Found '{{' in file: $generated_file"
      grep "{{" "$generated_file"
      exit 1
    fi
  done
}

# Main script execution starts here

# Check if the CSV file exists
check_csv_file "$csv_file"

# Define the keys directory
keys_dir="../keys"

# Process the CSV file
process_csv_file "$csv_file" "$keys_dir"
