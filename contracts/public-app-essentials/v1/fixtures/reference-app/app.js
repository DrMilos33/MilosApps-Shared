const places = [
  { id: "berlin", name: "Berlin", region: "Berlin", country: "Deutschland", countryCode: "DE", latitude: 52.52, longitude: 13.405 },
  { id: "bavaria", name: "Bayern", region: "Bayern", country: "Deutschland", countryCode: "DE", latitude: 48.95, longitude: 11.4 },
  { id: "london", name: "London", region: "England", country: "United Kingdom", countryCode: "GB", latitude: 51.5072, longitude: -0.1276 }
];

const placeSearch = document.querySelector("milos-place-search");
placeSearch.setSearchProvider(async ({ query }) => {
  const needle = query.toLocaleLowerCase();
  return places.filter((place) => `${place.name} ${place.region} ${place.country}`.toLocaleLowerCase().includes(needle));
});

const share = document.querySelector("milos-share-button");
share.setPayloadProvider(() => ({
  title: document.title,
  text: document.documentElement.lang === "en" ? "My MilosApps trip" : "Meine MilosApps-Reise",
  url: window.location.href
}));

requestAnimationFrame(() => {
  globalThis.milosAppEssentials.ready();
});
