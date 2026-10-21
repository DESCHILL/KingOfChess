const key = "kingofchess-tab";
let id = sessionStorage.getItem(key);
if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(key, id);
}
export const tabSession = id;
