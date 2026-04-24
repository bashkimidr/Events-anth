// Central SEO config. Everywhere in the codebase reads from window.SITE_CONFIG.
// At deploy time, only the `url` and `twitter` fields change — DO NOT scatter these values across multiple files.
window.SITE_CONFIG = {
    name:             "Eventeria",
    tagline:          "Events happening near you — find something to do today, this weekend, or next month.",
    shortDescription: "Find local events, concerts, workshops, and things to do near you.",
    url:              "https://eventhub.example.com",  // TODO: replace at deploy
    locale:           "en_US",
    locale_hreflang:  "en",
    twitter:          "@eventeria",                    // TODO: replace with real handle at deploy, or remove if none
    defaultOgImage:   "/social-og-default.png",        // 1200x630 PNG; will be created in Task 8
    themeColor:       "#8b5cf6",
    publisher: {
        name: "Eventeria",
        logo: "/icon-512.png"
    }
};
