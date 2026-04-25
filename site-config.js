// Central SEO config. Everywhere in the codebase reads from window.SITE_CONFIG.
// At deploy time, only the `url` field needs updating.
window.SITE_CONFIG = {
    name:             "Eventeria",
    tagline:          "Events happening near you — find something to do today, this weekend, or next month.",
    shortDescription: "Find local events, concerts, workshops, and things to do near you.",
    url:              "https://eventhub.example.com",  // TODO: replace at deploy
    locale:           "en_US",
    locale_hreflang:  "en",
    defaultOgImage:   "/social-og-default.png",
    themeColor:       "#8b5cf6",
    publisher: {
        name: "Eventeria",
        logo: "/icon-512.png"
    }
};
