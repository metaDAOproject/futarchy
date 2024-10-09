document.addEventListener('DOMContentLoaded', function () {
    var languageSelector = document.querySelector('.language-selector');
    var currentLanguageButton = document.getElementById('current-language');
    var languageOptions = document.getElementById('language-options');
    var languageItems = languageOptions.getElementsByTagName('li');

    // Toggle dropdown menu
    currentLanguageButton.addEventListener('click', function (e) {
        e.preventDefault();
        languageSelector.classList.toggle('open');
    });

    // Handle language selection
    for (var i = 0; i < languageItems.length; i++) {
        languageItems[i].addEventListener('click', function () {
            var selectedLanguage = this.getAttribute('data-lang');
            window.location.href = "/" + selectedLanguage + "/";
        });
    }
});