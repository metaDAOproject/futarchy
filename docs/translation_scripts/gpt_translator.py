import json
import os
import csv
import time
import sys
from openai import OpenAI
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()

# Get the OpenAI API key from the environment variables
api_key = os.getenv('OPENAI_API_KEY')

# Initialize OpenAI client with the API key from .env
client = OpenAI(api_key=api_key)
model = "gpt-4"


# Function to read JSON file
def read_json(file_name):
    if os.path.exists(file_name):
        with open(file_name, 'r', encoding='utf-8') as file:
            return json.load(file)
    else:
        print(f"{file_name} does not exist.")
        return None


def write_json(file_name, data):
    # If the file exists, read the current data
    if os.path.exists(file_name):
        with open(file_name, 'r', encoding='utf-8') as file:
            existing_data = json.load(file)
    else:
        existing_data = {}

    # Update existing data with new translations
    existing_data.update(data)

    # Write back the combined data
    with open(file_name, 'w', encoding='utf-8') as file:
        json.dump(existing_data, file, ensure_ascii=False, indent=4)

# Function to send translation request to GPT in batches
def translate_batch(texts, target_lang):
    # Prepare batch request
    batch_input = [
        {"role": "system", "content": """You are a professional translator. 
        Translate the given texts and provide only the translations in a JSON array format.
        This is text from public documentation of a crypto based Futarchy as a service protocol.
        The name of the company is MetaDAO.
        If you see autocrat it means the onchain program that program that orchestrates the futarchy.
        E-UP is short for Expected-UP. E-DOWN is short for expected down.
        This text is extracted from markdown so try preserve the syntax or symbols and especially links if you see any."""},
        {"role": "user", "content": f"Translate the following texts to this language {target_lang}:\n{json.dumps(texts)}"}
    ]

    # Define the response format schema
    response_format = {
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "translations": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["translations"]
        }
    }

    attempts = 0
    translations = None
    max_retries = 3
    delay = 5

    while attempts < max_retries:
        try:

            # Send request
            response = client.chat.completions.create(
                model="gpt-4o-realtime-preview-2024-10-01",  # Use the appropriate model
                messages=batch_input,
                temperature=0,
                max_tokens=6000,
                response_format=response_format
            )

            # Parse and return the translations
            translations = json.loads(response.choices[0].message.content)

            if not translations:
                print("No translations received. Skipping this batch.")
                # my add try again section

        except Exception as e:
            attempts += 1
            print(f"Attempt {attempts} failed: {str(e)}")
            if attempts < max_retries:
                print(f"Retrying in {delay} seconds...")
                time.sleep(delay)

    return translations["translations"]


# Method to find missing keys_backup in the target file
def get_missing_keys(source_strings, target_strings):
    return {key: source_strings[key] for key in source_strings if key not in target_strings}


# Method to calculate the number of characters and cost
def calculate_translation_cost(missing_keys):
    total_characters = sum(len(value) for value in missing_keys.values())
    estimated_cost = total_characters * 0.000003  # Cost per character
    return total_characters, estimated_cost


# Method to prompt the user for confirmation to proceed
def prompt_user_for_confirmation(total_characters, estimated_cost):
    print(f"Translation will cost approximately ${estimated_cost:.6f} based on {total_characters} characters.")
    user_input = input("Do you wish to continue? (Y/N): ")
    return user_input.strip().upper() == 'Y'


# Method to process translation in batches
def process_translation_in_batches(missing_keys, target_strings, target_lang, target_file, batch_size=10):
    keys = list(missing_keys.keys())

    # Translate missing keys_backup in batches
    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i + batch_size]  # Handles small batches, even if less than 10
        batch_texts = {key: missing_keys[key] for key in batch_keys}
        print(f"Translating batch: {batch_keys}")

        # Translate the batch
        translations = translate_batch(batch_texts, target_lang)

        # Update the target strings with translated texts
        for i, translation in enumerate(translations):
            key = list(batch_texts.keys())[i]  # Get the key corresponding to this index
            target_strings[key] = translation

        # Write updated data to target file
        write_json(target_file, target_strings)

# Main function to handle translation process
def handle_translation(source_lang, target_lang):
    source_file = f"{source_lang}_string.json"
    target_file = f"{target_lang}_string.json"

    # Read source and target JSON files
    source_strings = read_json(source_file)
    target_strings = read_json(target_file)

    # Exit the function early if either file is not found
    if source_strings is None or target_strings is None:
        print(f"Skipping translation from {source_lang} to {target_lang} due to missing files.")
        return  # Early exit from the function

    # Find missing keys_backup
    missing_keys = get_missing_keys(source_strings, target_strings)

    # Calculate total characters and cost
    total_characters, estimated_cost = calculate_translation_cost(missing_keys)

    # Prompt user for confirmation to proceed
    if not prompt_user_for_confirmation(total_characters, estimated_cost):
        print("Translation aborted.")
        return

    # Process the translations in batches
    process_translation_in_batches(missing_keys, target_strings, target_lang, target_file)

    updated_target_strings = read_json(target_file)

    if set(source_strings.keys()) == set(updated_target_strings.keys()):
        pass
    else:
        sys.exit(1)


# Example usage
if __name__ == "__main__":

    source_lang = "en"  # Replace with your source language code
    source_path = os.path.join("..", source_lang)

    languages_file = os.path.join(os.path.dirname(__file__), 'languages.csv')
    with open(languages_file, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row['Code'] != source_lang and row['Code'] == "zh-cn":
                language = row['Language']
                target_lang = row['Code']

                print(f'The target language is set to: {target_lang}')
                target_path = os.path.join("..", target_lang)
                handle_translation(source_path, target_path)
