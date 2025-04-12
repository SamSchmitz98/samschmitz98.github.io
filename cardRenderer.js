function createDuckCard(duck, options = {}) {
    const { showStats = false, firstFound, scans, isNew = false } = options;
    const card = document.createElement("div");
    card.classList.add("duck-card");
  
    card.innerHTML = `
      ${isNew ? `<div class="new-duck-banner">🎉 NEW DUCK!</div>` : ""}
      <h3>${duck.name}</h3>
      <p>${duck.fact}</p>
      ${duck.image ? `<img src="${duck.image}" alt="${duck.name}" />` : ""}
      ${
        showStats
          ? `<div class="duck-stats">
               <p><strong>First found:</strong> ${firstFound}</p>
               <p><strong>Times scanned:</strong> ${scans}</p>
             </div>`
          : ""
      }
    `;
  
    return card;
  }