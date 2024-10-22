- To add a language add the ISO code to languages.csv and run `./setLanguages.sh`
- To get translations for a new language or new strings run `./getTranslations.py`
  - Get you API key from here https://platform.openai.com/settings/profile?tab=api-keys
    - Run export `OPENAI_API_KEY= "$MY_SECRET"`
    - Run `pip install openai==1.51.2`
- To refactor the string for a specific language go to {code}_strings.json
  - When changing meaning or a string, (not making grammar fix) then rename the key
    in the file in ./keys and run `python3 getTranslations.py`
- To generate the translated .md files run `./genTranslatedDocs.sh`