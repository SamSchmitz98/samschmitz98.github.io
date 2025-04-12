const isDevMode = location.hostname === "localhost" || location.search.includes("dev=true");
devLog("🛠️ Dev mode enabled");
devLog("🔧 App.js loaded");
if (typeof DUCKS !== "undefined") {
  devLog("🦆 DUCKS object:", DUCKS);
} else {
  devLog("❌ DUCKS not defined");
}
// Create or open the database
const dbName = "DuckDatabase";
const dbVersion = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DuckAppImages", 1);

    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
    };

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };

    request.onerror = function(event) {
      reject("IndexedDB error: " + event.target.errorCode);
    };
  });
}

function storeImage(db, imageId, imageBlob) {
  if (!db) {
    console.error("DB not initialized. Cannot store image:", imageId);
    return;
  }

  const transaction = db.transaction(["images"], "readwrite");
  const store = transaction.objectStore("images");

  const image = {
    id: imageId,
    imageBlob: imageBlob,
    timestamp: Date.now(),
  };

  store.add(image);
}

// Retrieve images from IndexedDB
function getImage(db, imageId, callback) {
  const transaction = db.transaction(["images"], "readonly");
  const store = transaction.objectStore("images");

  const request = store.get(imageId);

  request.onsuccess = function (event) {
    const image = event.target.result;
    if (image) {
      callback(image.imageBlob);
    } else {
      console.log("Image not found.");
    }
  };

  request.onerror = function (event) {
    console.error("Error retrieving image", event);
  };
}

function devLog(...args) {
  if (isDevMode) console.log(...args);
}
window.devLog = function (...args) {
  if (isDevMode) console.log(...args);
};

if (window.location.pathname.includes("duck.html")) {
  devLog("🦆 duck.html loaded");

  const container = document.getElementById("duckInfo");
  if (!container) {
    console.warn("⚠️ duckInfo container not found in DOM");
  }

  let duck = null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const name = params.get("name");
  const fact = params.get("fact");
  const image = params.get("image");
  devLog("🔍 URL parameters:", { id, name, fact, image });

  // Fallback to loading from global DUCKS by ID if no URL parameters
  if (!name && !fact && !image && id && typeof DUCKS !== "undefined") {
    duck = DUCKS[id];
    devLog("📦 Loaded duck from DUCKS object:", duck);
  }

  // Create the duck card dynamically from URL parameters
  if (name || fact || image) {
    duck = {
      id: id,
      name: name || "Unknown Duck",
      fact: fact || "No fact available.",
      image: image || "", // Optional image URL
    };
    devLog("🦆 Created duck from URL parameters:", duck);
    // Try loading image from IndexedDB if caching is enabled
    if (localStorage.getItem("cacheImages") === "yes" && duck.image) {
      loadDuckImage(duck.image, "duckImage"); // Assumes <img id="duckImage"> exists in HTML
    }
  }

  if (duck) {
    const myDucks = JSON.parse(localStorage.getItem("myDucks") || "{}");
    const saved = myDucks[duck.id || duck.name];
    const isNew = !saved;

    // Show the "NEW DUCK" banner if the duck is new
    const newDuckBanner = document.getElementById('new-duck-banner');
    if (isNew && newDuckBanner) {
      newDuckBanner.style.display = "block"; // Show the banner
      setTimeout(() => {
        newDuckBanner.style.display = "none"; // Hide the banner after 3 seconds
      }, 3000);
    }

    const firstFound = isNew ? "Just now" : new Date(saved.firstFound).toLocaleString();
    const scans = isNew ? 1 : saved.scans;

    const card = createDuckCard(duck, {
      showStats: true,
      firstFound,
      scans,
      isNew
    });

    const collection = document.getElementById("collection");
    collection.appendChild(card); // Add the duck card inside the yellow box
    saveDuck(duck.id || duck.name, duck);
  } else {
    const collection = document.getElementById("collection");
    collection.textContent = "Duck not found.";
  }
}

function registerServiceWorker() {
  devLog("🛠 Service Worker support:", "serviceWorker" in navigator);
  devLog("📌 User swConsent status:", localStorage.getItem("swConsent"));
  devLog("📥 Registering service worker...");
  if ("serviceWorker" in navigator) {
    return navigator.serviceWorker.register("service-worker.js").then(() => {
      devLog("✅ Service Worker registered");
    });
  }else {
    return Promise.resolve(); // Return a resolved promise if service worker is not supported
  }
}

// Show install banner if service workers supported
const installBanner = document.getElementById("installBanner");
const swConsent = localStorage.getItem("swConsent");

if ("serviceWorker" in navigator && installBanner) {
  console.log("📣 Service workers supported, checking swConsent...");
  if (swConsent !== "yes") {
    console.log("📣 Displaying install banner...");
    installBanner.style.display = "block";

    document.getElementById("acceptInstall").addEventListener("click", async () => {
      localStorage.setItem("swConsent", "yes");

      // Prompt for image caching if not set
      const imageCacheDecision = localStorage.getItem("cacheImages");
      if (imageCacheDecision === null) {
        const userWantsImages = confirm("Would you like to cache duck images for offline use? (~3.4MB total)");
        localStorage.setItem("cacheImages", userWantsImages ? "yes" : "no");
      }
    
      // If the user wants images, store them in IndexedDB
      if (localStorage.getItem("cacheImages") === "yes") {
        const imagePaths = [
          "/images/duck_hat.png", // Add more image paths as needed
          "/images/duck_mustache.png"
        ];
        await storeImagesInDB(imagePaths);
      }

      await registerServiceWorker(); // Make sure it's registered before we try to message it
      installBanner.style.display = "none";
    });

    document.getElementById("declineInstall").addEventListener("click", () => {
      localStorage.setItem("swConsent", "no");
      installBanner.style.display = "none";
    });
  }
}

async function storeImagesInDB(images) {
  const db = await openDatabase();
  for (let imagePath of images) {
    try {
      const imageBlob = await fetch(imagePath).then(res => res.blob());
      storeImage(db, imagePath, imageBlob);
    } catch (error) {
      console.error("Failed to store image:", imagePath, error);
    }
  }
}

async function loadDuckImage(imageId) {
  const db = await openDatabase();
  getImage(db, imageId, (imageBlob) => {
    if (imageBlob) {
      // Display the image
      const imgElement = document.createElement('img');
      imgElement.src = URL.createObjectURL(imageBlob);
      document.getElementById('duckImage').appendChild(imgElement);
    } else {
      // Display a placeholder or error if image is not found in IndexedDB
      console.log("Image not found, showing placeholder.");
      const placeholder = document.createElement('img');
      placeholder.src = "/images/placeholder.png"; // Path to a placeholder image
      document.getElementById('duckImage').appendChild(placeholder);
    }
  });
}

// Function to create the duck card (using URL parameters)
function createDuckCard(duck, options) {
  const card = document.createElement('div');
  card.className = 'duck-card';
  
  if (duck.image) {
    const img = document.createElement('img');
    img.src = duck.image;
    img.alt = `Image of ${duck.name}`;
    card.appendChild(img);
  }
  
  const name = document.createElement('h3');
  name.textContent = duck.name;
  card.appendChild(name);
  
  if (options.showStats) {
    const stats = document.createElement('p');
    stats.textContent = `First Found: ${options.firstFound}, Scans: ${options.scans}`;
    card.appendChild(stats);
  }

  const fact = document.createElement('p');
  fact.textContent = `Fact: ${duck.fact}`;
  card.appendChild(fact);

  return card;
}

function saveDuck(idOrName, duckData) {
  if (!idOrName) {
    console.warn("⚠️ Missing ID or name; duck not saved.");
    return;
  }

  let found = JSON.parse(localStorage.getItem("myDucks") || "{}");
  const now = Date.now();
  const cooldown = 5 * 60 * 1000; // 5 minutes

  if (!found[idOrName]) {
    found[idOrName] = {
      ...duckData,
      firstFound: now,
      lastScanned: now,
      scans: 1
    };
  } else {
    const lastTime = found[idOrName].lastScanned || 0;
    if (now - lastTime > cooldown) {
      found[idOrName].scans += 1;
      found[idOrName].lastScanned = now;
    }
  }
  localStorage.setItem("myDucks", JSON.stringify(found));
  localStorage.setItem("visited", "true");
  devLog(`💾 Duck saved: ${idOrName}`);
}

document.getElementById("resetDev")?.addEventListener("click", async () => {
  if (!confirm("This will clear all ducks, caches, and unregister the service worker. Are you sure?")) return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let reg of regs) await reg.unregister();
    }
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (let name of cacheNames) await caches.delete(name);
    }

    localStorage.clear();
    alert("All data cleared. Reloading...");
    location.reload();
  } catch (err) {
    console.error("Error during dev reset:", err);
    alert("Something went wrong during dev reset.");
  }
});

// Show dev tools if in dev mode
if (isDevMode) {
  const devTools = document.getElementById("devTools");
  if (devTools) devTools.style.display = "block";
}
