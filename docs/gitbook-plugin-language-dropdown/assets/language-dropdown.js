document.addEventListener("DOMContentLoaded", function() {
    var languageButton = document.getElementById("current-language");
    var languageOptions = document.getElementById("language-options");

    languageButton.addEventListener("click", function() {
        languageOptions.classList.toggle("hidden");
    });

    var languageItems = document.querySelectorAll("#language-options li");
    languageItems.forEach(function(item) {
        item.addEventListener("click", function() {
            var selectedLang = item.getAttribute("data-lang");
            var currentUrl = window.location.href;
            var baseUrl;

            if (!currentUrl.includes("/" + selectedLang + "/")) {
                baseUrl = currentUrl.replace(/\/(en|zh-cn|es|pt-br|ru|vi|tr|fr|ja)\//, "/" + selectedLang + "/");
            } else {
                baseUrl = currentUrl;
            }

            window.location.href = baseUrl;
        });
    });
});
