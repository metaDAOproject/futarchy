import json
import os
import csv
import time
import sys
from openai import OpenAI
import re

# add key here or use $OPENAI_API_KEY

# Initialize OpenAI client with the API key from .env


def continue_or_exit():
    while True:
        response = input("Do you want to continue? (y/n): ").strip().lower()

        if response == 'y':
            print("Continuing...")
            break  # Continue with the rest of the program
        elif response == 'n':
            print("Exiting...")
            sys.exit(1)  # Exit the program with status 1
        else:
            print("Invalid input. Please enter 'y' for yes or 'n' for no.")


# Function to read JSON file
def read_json(file_name, can_create=False):
    if os.path.exists(file_name):
        with open(file_name, 'r', encoding='utf-8') as file:
            return json.load(file)
    else:
        if can_create:
            # Create an empty JSON file if it does not exist
            with open(file_name, 'w', encoding='utf-8') as file:
                json.dump({}, file)  # Initialize an empty JSON object
            return {}
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
def translate_batch(texts, target_lang, nested):
    # Prepare batch request
    if nested:
        batch_input = [
            {"role": "system", "content": """You are a professional translator.
            This is text from public documentation of a crypto based Futarchy as a service (FaaS) protocol.
            Proposals are created and then traded in the decision markets. The name of the company is MetaDAO. The native token is META.
            If you see autocrat it means the onchain program that program that orchestrates the futarchy. How communication happens on Discord and Telegram
            E-UP is short for Expected-UP. E-DOWN is short for expected down. Some words here will not have obvious equivalents so the meaning should be conveyed in a culturally aware way.
            This text is extracted from markdown so preserve the syntax, symbols, spaces and especially links if you see any.
            This string had links so has been split up to help with translation. Translate the full sentence and then individual parts. Ensure the text and link text are set for the appropriate characters."""},
            {"role": "user", "content": f"Translate the following texts to this language {target_lang}:\n{json.dumps(texts)}"}
        ]
    else:
        batch_input = [
            {"role": "system", "content": """You are a professional translator.
            This is text from public documentation of a crypto based Futarchy as a service (FaaS) protocol.
            Proposals are created and then traded in the decision markets. The name of the company is MetaDAO. The native token is META.
            If you see autocrat it means the onchain program that program that orchestrates the futarchy. How communication happens on Discord and Telegram
            E-UP is short for Expected-UP. E-DOWN is short for expected down. Some words here will not have obvious equivalents so the meaning should be conveyed in a culturally aware way.
            This text is extracted from markdown so preserve the syntax, symbols, spaces and especially links if you see any."""},
            {"role": "user", "content": f"Translate the following texts to this language {target_lang}:\n{json.dumps(texts)}"}
        ]

    attempts = 0
    translations = None
    max_retries = 3
    delay = 5

    while attempts < max_retries:
        try:
            # Send request
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=batch_input,
                temperature=0,
            )

            # Step 1: Extract the 'content' string from the response
            translations_list = response.choices[0].message.content
            print(translations_list)
            translation_json = json.loads(translations_list)
            return translation_json

            break

        except Exception as e:
            attempts += 1
            print(f"Attempt {attempts} failed: {str(e)}")
            if attempts < max_retries:
                print(f"Retrying in {delay} seconds...")
                time.sleep(delay)

    sys.exit(1)


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


def construct_full_text(value):
    full_text = ''
    counter = 1
    while True:
        has_any = False
        # Get text_{counter}
        text_key = f'text_{counter}'
        if text_key in value:
            full_text += value[text_key]
            has_any = True

        # Get link_text_{counter} and link_{counter}
        link_text_key = f'link_text_{counter}'
        link_key = f'link_{counter}'
        if link_text_key in value and link_key in value:
            full_text += f'[{value[link_text_key]}]({value[link_key]})'
            has_any = True
        elif link_text_key in value:
            # If only link_text_{counter} exists
            full_text += f'[{value[link_text_key]}]'
            has_any = True
        elif link_key in value:
            # If only link_{counter} exists
            full_text += f'({value[link_key]})'
            has_any = True

        if not has_any:
            break  # Exit loop if no keys found for this counter

        counter += 1

    # Overwrite or create 'full_text' key
    value['full_text'] = full_text
    return value


def replace_link_keys(translated, original):
    if isinstance(translated, dict) and isinstance(original, dict):
        for key in translated:
            # Recurse into nested dictionaries
            translated[key] = replace_link_keys(translated[key], original.get(key, {}))
            # Check if the key matches 'link_{integer}'
            if re.match(r'^link_\d+$', key):
                # Replace the value with the original
                translated[key] = original[key]
    elif isinstance(translated, list) and isinstance(original, list):
        # Recurse into lists
        for i in range(len(translated)):
            translated[i] = replace_link_keys(translated[i], original[i])
    return translated


# Method to process translation in batches
def process_translation_in_batches(missing_keys, target_strings, target_lang, target_file):
    for key, value in missing_keys.items():
        # Replace the main key with '1' to minimize translation costs
        temp_batch = {'1': value}
        print(f"Translating batch for key '{key}': {temp_batch}")
        continue_or_exit()
        # Determine if the value is nested
        nested = isinstance(value, dict)
        # Translate the batch
        translations = translate_batch(temp_batch, target_lang, nested)
        # Map '1' back to the original key
        translated_value = translations['1']
        # Replace any sub-keys matching 'link_{integer}' with the original
        translated_value = replace_link_keys(translated_value, value)

        if nested:
            # Construct 'full_text' key after translation
            translated_value = construct_full_text(translated_value)
        # Update target_strings with the translated value
        target_strings[key] = translated_value
        continue_or_exit()
        # Write the updated data to the target file
        write_json(target_file, target_strings)


# Main function to handle translation process
def handle_translation(source_path, target_path, target_lang):
    print(source_path, target_path)
    source_file = f"{source_path}_string.json"
    target_file = f"{target_path}_string.json"

    # Read source and target JSON files
    source_strings = read_json(source_file, False)
    target_strings = read_json(target_file, True)

    # Exit the function early if either file is not found
    if source_strings is None:
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
    source_path = os.path.join("..", source_lang, source_lang)

    languages_file = os.path.join(os.path.dirname(__file__), 'languages.csv')
    with open(languages_file, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row['Code'] != source_lang and row['Code'] == "zh-cn":
                language = row['Language']
                target_lang = row['Code']

                print(f'The target language is set to: {target_lang}')
                target_path = os.path.join("..", target_lang, target_lang)
                handle_translation(source_path, target_path, target_lang)
