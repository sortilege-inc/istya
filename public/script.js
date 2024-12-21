/**
 * script.js
 * Handles fetching the file list, loading data, and rendering
 * either a generic form or a fancy character sheet, all in one page.
 */

// Use `let` so we can assign these later
let fileListElem = null;
let jsonContainerElem = null;

document.addEventListener('DOMContentLoaded', () => {
  // Now that DOM is loaded, get references to elements
  fileListElem = document.getElementById('fileList');
  jsonContainerElem = document.getElementById('jsonContainer');
  // Fetch the list of available JSON files
  fetchFileList();
});

/**
 * Fetches the list of JSON files from the server
 */
function fetchFileList() {
  fetch('/api/files')
    .then(response => response.json())
    .then(fileNames => {
      fileListElem.innerHTML = '';
      fileNames.forEach(name => {
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.addEventListener('click', () => loadFile(name));
        fileListElem.appendChild(btn);
        fileListElem.appendChild(document.createElement('br'));
      });
    })
    .catch(err => {
      fileListElem.textContent = 'Error loading file list.';
      console.error(err);
    });
}

/**
 * Loads a specific file and determines how to render it
 */
function loadFile(filename) {
  fetch(`/api/actor/${filename}`)
    .then(response => response.json())
    .then(data => {
      // Clear existing form or sheet
      jsonContainerElem.innerHTML = '';

      // Check the actor type
      if (data.type === 'character') {
        // Render fancy character sheet
        renderCharacterSheet(data);
      } else {
        // Render generic form
        renderGenericForm(filename, data);
      }
    })
    .catch(err => {
      console.error('Error loading JSON file:', err);
      jsonContainerElem.textContent = 'Error loading JSON file.';
    });
}

/**
 * Renders a generic form for non-character actor types
 */
function renderGenericForm(filename, data) {
  const form = document.createElement('form');
  form.innerHTML = `<h2 class="fancy-heading">${filename}</h2>`;

  // For each key in data, create a label + input/textarea
  for (const key in data) {
    const value = data[key];
    const label = document.createElement('label');
    label.textContent = key;

    let field;
    if (typeof value === 'object') {
      // For objects, store them as JSON in a textarea
      field = document.createElement('textarea');
      field.value = JSON.stringify(value, null, 2);
      field.rows = 5;
    } else {
      // For simple strings, use an input
      field = document.createElement('input');
      field.type = 'text';
      field.value = value;
    }
    field.name = key;

    form.appendChild(label);
    form.appendChild(field);
  }

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.type = 'submit';
  form.appendChild(saveBtn);

  // Handle form submission
  form.addEventListener('submit', evt => {
    evt.preventDefault();

    // Build an object from the form fields
    const formData = {};
    for (let element of form.elements) {
      if (!element.name) continue; // skip non-inputs
      let fieldValue = element.value;
      // Try parsing JSON in case of an object
      try {
        fieldValue = JSON.parse(fieldValue);
      } catch (e) {
        // Not valid JSON; keep as a string
      }
      formData[element.name] = fieldValue;
    }

    // POST the updated data
    fetch(`/api/actor/${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then(res => res.text())
      .then(msg => {
        alert(msg); // e.g. "File saved successfully"
      })
      .catch(err => {
        console.error('Error saving file:', err);
        alert('Error saving file.');
      });
  });

  jsonContainerElem.appendChild(form);
}

/**
 * Renders a fancy character sheet if data.type === "character"
 */
function renderCharacterSheet(data) {
  // Create the main container
  const sheetDiv = document.createElement('div');
  sheetDiv.classList.add('character-sheet');

  // 1) Get the portrait file from prototypeToken.texture.src
  const portraitURL = data.prototypeToken?.texture?.src;
  
  // 2) Build the portrait HTML
  let portraitHTML;
  if (portraitURL) {
    // If we have a valid local filename, show it as an <img>
    // e.g., "images/celenneth.png" or "celenneth.jpg"
    portraitHTML = `
      <div class="portrait">
        <img src="images/${portraitURL}" alt="Portrait" />
      </div>
    `;
  } else {
    // Fallback if no portrait path is specified
    portraitHTML = `<div class="portrait">Portrait</div>`;
  }

  // 3) Incorporate the portrait into your header HTML
  const headerHTML = `
    <header class="sheet-header">
      <div class="sheet-title">
        <h1 class="character-name">${data.name || 'Unnamed'}</h1>
        <p class="character-epithet">${data.culture || ''}</p>
      </div>
      <div class="portrait-container">
        ${portraitHTML}
      </div>
    </header>
  `;

  // Basic info
  const leftColHTML = `
    <div class="info-column">
      <h2>Character</h2>
      <ul class="char-details">
        <li><strong>Culture:</strong> ${data.culture || ''}</li>
        <li><strong>Shadow:</strong> ${data.system?.shadow || ''}</li>
        <li><strong>Patron:</strong> ${data.system?.patron || ''}</li>
      </ul>
    </div>
  `;

  // Attributes (rating & TN)
  const strengthRating = data.system?.attributes?.strength || 0;
  const heartRating = data.system?.attributes?.heart || 0;
  const witsRating = data.system?.attributes?.wits || 0;

  const strengthTN = data.system?.tn?.strength || 0;
  const heartTN = data.system?.tn?.heart || 0;
  const witsTN = data.system?.tn?.wits || 0;

  const centerColHTML = `
    <div class="info-column center-col">
      <h2>Attributes</h2>
      <div class="attributes-row">
        <div class="attribute-block">
          <h3>Strength</h3>
          <p class="rating">${strengthRating}</p>
          <p class="target-num">TN: ${strengthTN}</p>
        </div>
        <div class="attribute-block">
          <h3>Heart</h3>
          <p class="rating">${heartRating}</p>
          <p class="target-num">TN: ${heartTN}</p>
        </div>
        <div class="attribute-block">
          <h3>Wits</h3>
          <p class="rating">${witsRating}</p>
          <p class="target-num">TN: ${witsTN}</p>
        </div>
      </div>
    </div>
  `;

  // Gear & Endurance
  const gearList = data.system?.gear || 'No gear listed';
  const enduranceMax = data.system?.endurance?.max || 0;
  const enduranceCurrent = data.system?.endurance?.current || 0;

  const rightColHTML = `
    <div class="info-column">
      <h2>Gear</h2>
      <ul class="char-details">
        <li>${gearList}</li>
      </ul>

      <h2>Endurance</h2>
      <p>Max: <strong>${enduranceMax}</strong></p>
      <p>Current: <strong>${enduranceCurrent}</strong></p>
    </div>
  `;

  // Combine columns
  const infoGridHTML = `
    <section class="info-grid">
      ${leftColHTML}
      ${centerColHTML}
      ${rightColHTML}
    </section>
  `;

  // Handle commonSkills
  let commonSkills = data.system?.commonSkills;

  // If it's an object, convert to an array of [key, value]
  if (commonSkills && !Array.isArray(commonSkills)) {
    commonSkills = Object.entries(commonSkills).map(([skillKey, skillData]) => {
      // skillKey is the parent's key (e.g. "athletics"), skillData is the object
      // Attach the key so we can display it or use it if label is missing
      return {
        skillKey: skillKey,
        ...skillData
      };
    });
  }
  // If still undefined/falsy, default to empty array
  if (!commonSkills) {
    commonSkills = [];
  }

  // Filter and sort by attribute
  const strengthSkills = commonSkills
    .filter(s => s.roll?.associatedAttribute === 'strength')
    .sort((a, b) => (a.skillKey || '').localeCompare(b.skillKey || ''));
  const heartSkills = commonSkills
    .filter(s => s.roll?.associatedAttribute === 'heart')
    .sort((a, b) => (a.skillKey || '').localeCompare(b.skillKey || ''));
  const witsSkills = commonSkills
    .filter(s => s.roll?.associatedAttribute === 'wits')
    .sort((a, b) => (a.skillKey || '').localeCompare(b.skillKey || ''));

  // Build skill HTML
  function buildSkillHTML(skill) {
    const star = skill.favoured ? '★ ' : '';

    // Start with skill.label if present, else skillKey, else 'Unnamed'
    let skillName = skill.label || skill.skillKey || 'Unnamed';

    // Remove the prefix "tor2e.commonSkills." if present
    skillName = skillName.replace(/^tor2e\.commonSkills\./, '');

    // Capitalize the first character
    if (skillName.length > 0) {
      skillName = skillName[0].toUpperCase() + skillName.slice(1);
    }

    // Build squares
    const rating = skill.value || 0;
    const clamped = Math.max(0, Math.min(rating, 6));
    const filled = '■'.repeat(clamped);
    const empty = '□'.repeat(6 - clamped);

    return `
      <div class="skill-line">
        ${star}${skillName}: ${filled}${empty}
      </div>
    `;
  }



  // Skills section (3 columns)
  const skillSectionHTML = `
    <section class="skills-section">
      <h2>Common Skills</h2>
      <div class="skill-grid-3col">
        <div>
          <h3>Strength-based</h3>
          ${strengthSkills.map(buildSkillHTML).join('')}
        </div>
        <div>
          <h3>Heart-based</h3>
          ${heartSkills.map(buildSkillHTML).join('')}
        </div>
        <div>
          <h3>Wits-based</h3>
          ${witsSkills.map(buildSkillHTML).join('')}
        </div>
      </div>
    </section>
  `;

  // Combat section (placeholder)
  const parryVal = data.system?.combat?.parry || 0;
  const protectionVal = data.system?.combat?.protection || '0d';

  const combatSectionHTML = `
    <section class="combat-section">
      <h2>Combat</h2>
      <div class="combat-grid">
        <div class="combat-column">
          <h3>Parry</h3>
          <div class="stat-block">
            <span class="big-number">${parryVal}</span>
          </div>
        </div>
        <div class="combat-column">
          <h3>Protection</h3>
          <div class="stat-block">
            <span class="big-number">${protectionVal}</span>
          </div>
        </div>
      </div>
    </section>
  `;

  // Put everything together
  sheetDiv.innerHTML = `
    ${headerHTML}
    ${infoGridHTML}
    ${skillSectionHTML}
    ${combatSectionHTML}
  `;

  // Finally, attach to container
  jsonContainerElem.appendChild(sheetDiv);
}
