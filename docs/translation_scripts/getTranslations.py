import json
import os
import csv
import time
import sys
import logging
import re
from typing import List, Dict, Union
from openai import OpenAI

# Setup logging
logging.basicConfig(level=logging.INFO)


class ClientManager:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("Error: OPENAI_API_KEY is not set in the environment.")
        self.client = OpenAI(api_key=self.api_key)


class TranslationService:
    def __init__(self, client: OpenAI):
        self.client = client

    def set_propmpt(self, texts: List[str], target_lang: str, nested: bool) -> Dict:
        system_message = """You are a professional translator.
            This is text from public documentation of a crypto based Futarchy as a service (FaaS) protocol.
            Proposals are created and then traded in the decision markets. The name of the company is MetaDAO. The native token is META.
            Do not translate "Futarchy", "META", "MetaDAO" or "Futarchic" keep them in English. Remove all italics from underscore characters arround text _ _ for non latin alphabets.
            If there is an adjective noun combination still translate the adjective as an adjective unless there are already established idiomatic translations.
            If you see autocrat it means the onchain program that program that orchestrates the futarchy.
            E-UP is short for Expected-UP. E-DOWN is short for expected down. Some words here will not have obvious equivalents so the meaning should be conveyed in a culturally aware way.
            This text is extracted from markdown so preserve the syntax, symbols, spaces and especially links if you see any. """

        if nested:
            system_message += "This string had links so has been split up to help with translation. Translate the full sentence and then individual parts. Ensure the text and link text are set for the appropriate characters. "

        system_message += "Do the best translation you can and make sure it makes sense. Return valid JSON."

        batch_input = [
            {"role": "system", "content": system_message},
            {"role": "user",
             "content": f"Translate the following texts to this language {target_lang}:\n{json.dumps(texts)}"}
        ]

        return TranslationService._make_api_call_with_retries(lambda: self._send_translation_request(batch_input))

    def _send_translation_request(self, batch_input):
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=batch_input,
            temperature=0
        )

        translations_list = response.choices[0].message.content
        translations_list = re.sub(r'^```(?:json)?\n(.*?)\n```$', r'\1', translations_list, flags=re.DOTALL)
        return json.loads(translations_list)

    @staticmethod
    def _make_api_call_with_retries(call_fn, max_retries=3, delay=5):
        attempts = 0
        while attempts < max_retries:
            try:
                return call_fn()
            except Exception as e:
                attempts += 1
                logging.error(f"Attempt {attempts} failed: {str(e)}")
                if attempts < max_retries:
                    logging.info(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
        raise Exception("Error: Translation request failed after retries.")


def read_json(file_name: str, can_create: bool = False) -> Union[Dict, None]:
    if os.path.exists(file_name):
        with open(file_name, 'r', encoding='utf-8') as file:
            return json.load(file)
    else:
        if can_create:
            with open(file_name, 'w', encoding='utf-8') as file:
                json.dump({}, file)  # Initialize an empty JSON object
            return {}
        return None


def write_json(file_name: str, data: Dict):
    if os.path.exists(file_name):
        with open(file_name, 'r', encoding='utf-8') as file:
            existing_data = json.load(file)
    else:
        existing_data = {}
    existing_data.update(data)
    with open(file_name, 'w', encoding='utf-8') as file:
        json.dump(existing_data, file, ensure_ascii=False, indent=4)


def get_missing_keys(source_strings: Dict, target_strings: Dict) -> Dict:
    return {key: source_strings[key] for key in source_strings if key not in target_strings}


def estimate_translation_cost(missing_keys: Dict) -> (int, float):
    total_characters = sum(len(value) for value in missing_keys.values())
    estimated_cost = total_characters * 0.000015  # Cost per character
    return total_characters, estimated_cost


def prompt_user_for_confirmation(total_characters: int, estimated_cost: float) -> bool:
    print(f"Translation will cost approximately ${estimated_cost:.6f} based on {total_characters} characters.")
    user_input = input("Do you wish to continue? (Y/N): ")
    return user_input.strip().upper() == 'Y'


def reconstruct_links(value: Dict) -> Dict:
    full_text = ''
    counter = 1
    while True:
        has_any = False
        text_key = f'text_{counter}'
        link_text_key = f'link_text_{counter}'
        link_key = f'link_{counter}'

        if text_key in value:
            full_text += value[text_key]
            has_any = True

        if link_text_key in value and link_key in value:
            full_text += f'[{value[link_text_key]}]({value[link_key]})'
            has_any = True
        elif link_text_key in value:
            full_text += f'[{value[link_text_key]}]'
            has_any = True
        elif link_key in value:
            full_text += f'({value[link_key]})'
            has_any = True

        if not has_any:
            break
        counter += 1

    value['full_text'] = full_text
    return value


def replace_link_keys(translated: Union[Dict, List], original: Union[Dict, List]) -> Union[Dict, List]:
    if isinstance(translated, dict) and isinstance(original, dict):
        for key in translated:
            translated[key] = replace_link_keys(translated[key], original.get(key, {}))
            if re.match(r'^link_\d+$', key):
                translated[key] = original[key]
    elif isinstance(translated, list) and isinstance(original, list):
        for i in range(len(translated)):
            translated[i] = replace_link_keys(translated[i], original[i])
    return translated


def process_translation(service: TranslationService, missing_keys: Dict, target_strings: Dict, target_lang: str,
                        target_file: str):
    for key, value in missing_keys.items():
        temp_batch = {'1': value}

        nested = isinstance(value, dict)

        translations = service.set_propmpt(temp_batch, target_lang, nested)

        translated_value = translations['1']

        translated_value = replace_link_keys(translated_value, value)

        if nested:
            translated_value = reconstruct_links(translated_value)

        target_strings[key] = translated_value

        write_json(target_file, target_strings)


def handle_sources(service: TranslationService, source_path: str, target_path: str, target_lang: str):
    source_file = f"{source_path}_strings.json"
    target_file = f"{target_path}_strings.json"

    source_strings = read_json(source_file, False)
    target_strings = read_json(target_file, True)

    if source_strings is None:
        logging.warning(f"Skipping translation from {source_path} to {target_lang} due to missing files.")
        return

    missing_keys = get_missing_keys(source_strings, target_strings)

    total_characters, estimated_cost = estimate_translation_cost(missing_keys)

    if not prompt_user_for_confirmation(total_characters, estimated_cost):
        logging.info("Translation aborted.")
        return

    process_translation(service, missing_keys, target_strings, target_lang, target_file)

    updated_target_strings = read_json(target_file)

    if set(source_strings.keys()) == set(updated_target_strings.keys()):
        logging.info("Translation completed successfully.")
    else:
        logging.error("Error: Keys mismatch")
        sys.exit("Error: Keys mismatch")


def set_languages(service: TranslationService):
    source_lang = "en"
    source_path = os.path.join("..", source_lang, source_lang)

    languages_file = os.path.join(os.path.dirname(__file__), 'languages.csv')
    with open(languages_file, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row['Code'] != source_lang:
                target_lang = row['Code']
                logging.info(f'The target language is set to: {target_lang}')
                target_path = os.path.join("..", target_lang, target_lang)
                handle_sources(service, source_path, target_path, target_lang)


def main():
    client_manager = ClientManager()
    service = TranslationService(client_manager.client)
    set_languages(service)


if __name__ == "__main__":
    main()
