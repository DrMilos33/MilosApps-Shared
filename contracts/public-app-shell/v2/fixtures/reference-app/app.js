const messages = {
  de: {
    documentTitle: "Shell-Referenz – MilosApps",
    eyebrow: "Frameworkneutrale Referenz",
    title: "Eine Shell, viele unabhängige Apps",
    intro: "Header, Footer und Sprache stammen aus einem gepinnten Build-Artefakt.",
    cardTitle: "App-eigener Inhalt",
    cardText: "Diese Fläche bleibt vollständig im App-Repository."
  },
  en: {
    documentTitle: "Shell reference – MilosApps",
    eyebrow: "Framework-neutral reference",
    title: "One shell, many independent apps",
    intro: "Header, footer and language come from a pinned build artifact.",
    cardTitle: "App-owned content",
    cardText: "This area remains entirely inside the app repository."
  }
};

if (new URLSearchParams(window.location.search).get("textZoom") === "200") {
  document.documentElement.style.fontSize = "200%";
}

function applyAppLocale(locale) {
  const selected = locale === "en" ? "en" : "de";
  const dictionary = messages[selected];
  document.title = dictionary.documentTitle;
  document.querySelectorAll("[data-app-text]").forEach((element) => {
    element.textContent = dictionary[element.dataset.appText];
  });
}

window.addEventListener("milosapps:localechange", (event) => {
  applyAppLocale(event.detail.locale);
});

applyAppLocale(document.documentElement.lang);
