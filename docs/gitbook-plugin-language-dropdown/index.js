module.exports = {
    website: {
        assets: "./assets",
        js: ["language-dropdown.js"],
        css: ["language-dropdown.css"]
    },
    hooks: {
        "page:before": function(page) {
            // Update 'pluginsConfig.language-dropdown' to 'pluginsConfig.gitbook-plugin-language-dropdown'
            var languages = this.config.get('pluginsConfig.gitbook-plugin-language-dropdown.languages');
            var dropdownHtml = generateDropdownHtml(languages);

            // Inject language selector after the header's loading spinner
            page.content = page.content.replace(
                '<i class="fa fa-circle-o-notch fa-spin"></i>',
                '<i class="fa fa-circle-o-notch fa-spin"></i>' + dropdownHtml
            );
            return page;
        }
    }
};

function generateDropdownHtml(languages) {
    var html = `
    <div class="language-selector">
        <button id="current-language">
            ${languages[0].name} <!-- Default language -->
            <span class="arrow-down"></span>
        </button>
        <ul id="language-options" class="hidden">
  `;

    languages.forEach(function(lang) {
        html += `<li data-lang="${lang.code}">${lang.name}</li>`;
    });

    html += `
        </ul>
    </div>
  `;

    return html;
}
