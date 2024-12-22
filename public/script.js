/**
 * script.js
 * A merged single-page app with:
 * - Diamond attributes (20 - value = TN)
 * - Skills (prefix stripping, star for favored)
 * - Portrait from prototypeToken.texture.src if present
 * - Fallback generic form for non-character actors
 */

let fileListElem = null;
let jsonContainerElem = null;

document.addEventListener('DOMContentLoaded', () => {
  fileListElem = document.getElementById('fileList');
  jsonContainerElem = document.getElementById('jsonContainer');
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
 * Loads a specific JSON file and determines how to render it
 */
function loadFile(filename) {
  fetch(`/api/actor/${filename}`)
    .then(response => response.json())
    .then(data => {
      // Clear existing content
      jsonContainerElem.innerHTML = '';

      // Decide how to render
      if (data.type === 'character') {
        renderCharacterSheet(data);
      } else {
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

  // Create fields for all keys
  for (const key in data) {
    const value = data[key];
    const label = document.createElement('label');
    label.textContent = key;

    let field;
    if (typeof value === 'object') {
      field = document.createElement('textarea');
      field.value = JSON.stringify(value, null, 2);
      field.rows = 5;
    } else {
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

  // Submission
  form.addEventListener('submit', evt => {
    evt.preventDefault();
    const formData = {};
    for (let element of form.elements) {
      if (!element.name) continue;
      let fieldValue = element.value;
      try {
        fieldValue = JSON.parse(fieldValue);
      } catch (e) {
        // Not valid JSON, keep string
      }
      formData[element.name] = fieldValue;
    }

    fetch(`/api/actor/${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then(res => res.text())
      .then(msg => {
        alert(msg);
      })
      .catch(err => {
        console.error('Error saving file:', err);
        alert('Error saving file.');
      });
  });

  jsonContainerElem.appendChild(form);
}

// Global tooltips variable
let tooltips = {};

// Fetch tooltips from a JSON file
fetch('tooltips.json')
  .then(response => response.json())
  .then(data => {
    tooltips = data; // Store tooltips globally
  })
  .catch(err => console.error('Error loading tooltips:', err));


function rollSkill(skill, associatedAttribute, characterState, advantage = 0) {
  const { value: skillRanking, favoured } = skill; // Extract skill ranking and favoured state
  const isFavoured = favoured?.value || false;

  // Determine dice rolls
  const featDice = isFavoured ? 2 : 1; // Roll 2d12 if favoured
  const skillDice = skillRanking + advantage; // Adjust skill dice by advantage/disadvantage

  // Roll feat dice
  const featRolls = [];
  for (let i = 0; i < featDice; i++) {
    featRolls.push(rollDie(12)); // Custom function to roll d12
  }

  // Roll skill dice
  const skillRolls = [];
  for (let i = 0; i < skillDice; i++) {
    skillRolls.push(rollDie(6)); // Custom function to roll d6
  }

  // Apply rules based on character state
  const isMiserable = characterState.includes("miserable");
  const isWeary = characterState.includes("weary");

  // Process feat dice
  const featDieResult = processFeatDice(featRolls, isMiserable);

  // Process skill dice
  const processedSkillDice = processSkillDice(skillRolls, isWeary);

  // Calculate total
  const total = featDieResult.total + processedSkillDice.total;

  return {
    rolls: [featDieResult.kept, ...processedSkillDice.kept], // Kept dice results
    total,
    featDieResult,
    skillDiceResults: processedSkillDice,
  };
}

// Helper to roll a die
function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// Process feat dice
function processFeatDice(featRolls, isMiserable) {
  let kept = Math.max(...featRolls); // Default: keep the highest roll
  const total = kept === 12 ? 10 : kept === 11 ? (isMiserable ? 0 : -1) : kept; // Gandalf Rune or Eye of Sauron

  return { total, kept };
}

// Process skill dice
function processSkillDice(skillRolls, isWeary) {
  const kept = skillRolls.map(roll => {
    if (isWeary && roll <= 3) return 0; // 1, 2, 3 become 0 if Weary
    return roll;
  });

  const total = kept.reduce((sum, roll) => sum + roll, 0);
  return { total, kept };
}


/**
 * Renders a fancy character sheet if data.type === 'character'
 */
function renderCharacterSheet(data) {
  const sheetDiv = document.createElement('div');
  sheetDiv.classList.add('character-sheet');

  // 1) PORTRAIT LOGIC
  let portraitHTML = `<div class="portrait">Portrait</div>`;
  const portraitURL = data.prototypeToken?.texture?.src;
  if (portraitURL) {
    portraitHTML = `
      <div class="portrait">
        <img src="images/${portraitURL}" alt="Portrait" />
      </div>
    `;
  }

  // 2) HEADER
  const headerHTML = `
    <header class="sheet-header">
      <div class="sheet-title">
        <h1 class="character-name">${data.name || 'Unnamed'}</h1>
        <h4>${data.system.biography.culture.value}</h4>
        <p class="character-status">
          <label><input type="checkbox" ${data.system.stateOfHealth.miserable.value ? 'checked' : ''} /> Miserable</label>
          <label><input type="checkbox" ${data.system.stateOfHealth.weary.value ? 'checked' : ''} /> Weary</label>
          <label><input type="checkbox" ${data.system.stateOfHealth.wounded.value ? 'checked' : ''} /> Wounded</label>
        </p>
      </div>
      <div class="portrait-container">
        ${portraitHTML}
      </div>
    </header>
  `;

  // Endurance and Hope Section
  const enduranceHopeSection = document.createElement('section');
  enduranceHopeSection.classList.add('endurance-hope-section');

  enduranceHopeSection.innerHTML = `
    <div class="endurance">
      <h3>Endurance</h3>
      <p>Maximum: ${data.system.resources.endurance.max}</p>
      <p>Current: ${data.system.resources.endurance.value}</p>
      <p>Load: ${data.system.resources.travelLoad.value}</p>
      <p>Fatigue: ${data.system.resources.fatigue || '0'}</p>
    </div>
    <div class="hope">
      <h3>Hope</h3>
      <p>Maximum: ${data.system.resources.hope.max}</p>
      <p>Current: ${data.system.resources.hope.value}</p>
      <p>Shadow: ${data.system.resources.shadow.temporary.value}</p>
      <p>Scars: ${data.system.resources.shadow.shadowScars.value}</p>
    </div>
  `;

  sheetDiv.appendChild(enduranceHopeSection);


  // 3) Example left / right columns
  const leftColHTML = `
    <div class="info-column">
      <h2>Character</h2>
      <ul>
        <li><strong>Culture:</strong> ${data.culture || ''}</li>
        <li><strong>Shadow:</strong> ${data.system?.shadow || ''}</li>
        <li><strong>Patron:</strong> ${data.system?.patron || ''}</li>
      </ul>
    </div>
  `;
  const centerColHTML = `
    <div class="info-column center-col">
      <h2>Some Middle Info</h2>
      <p>Placeholder center content</p>
    </div>
  `;
  const rightColHTML = `
    <div class="info-column">
      <h2>Gear</h2>
      <p>${data.system?.gear || 'No gear listed'}</p>
    </div>
  `;
  const infoGridHTML = `
    <section class="info-grid">
      <div class="info-column">
        <h3>Character</h3>
        <ul>
          <li>Heroic Culture: ${data.system.biography.culture.value}</li>
          <li>Cultural Blessing: ${data.system.biography.culturalBlessing.value}</li>
          <li>Calling: ${data.system.biography.calling.value}</li>
          <li>Living Standard: ${data.system.biography.standardOfLiving.value}</li>
          <li>Patron: ${data.system.biography.patron?.value || 'None'}</li>
          <li>Features: ${data.system.features || 'N/A'}</li>
          <li>Shadow Curse: ${data.system.biography.shadowPath.value}</li>
          <li>Flaws: ${data.system.flaws || 'None'}</li>
        </ul>
      </div>
      <div class="info-column">
        <h3>Virtues</h3>
        <ul>
          ${data.items
            .filter(item => item.type === 'virtues')
            .map(virtue => `<li>${virtue.name}: ${virtue.system.description.value}</li>`)
            .join('')}
        </ul>
      </div>
      <div class="info-column">
        <h3>Rewards</h3>
        <ul>
          ${data.items
            .filter(item => item.type === 'reward')
            .map(reward => `<li>${reward.name}: ${reward.system.description.value}</li>`)
            .join('')}
        </ul>
      </div>
    </section>
  `;
  sheetDiv.innerHTML += infoGridHTML;


  // 4) ATTRIBUTES (diamond layout)
  // We expect data.attributes to be an object, e.g.:
  // "attributes": {
  //   "tor2e.attributes.strength": { label: "...", value: 14, ... },
  //   "tor2e.attributes.heart":    { label: "...", value: 15, ... },
  //   "tor2e.attributes.wits":     { label: "...", value: 16, ... }
  // }

  const attributesObj = data.system?.attributes || {};
  const attributesArr = Object.entries(attributesObj).map(([key, attr]) => ({
    rawKey: key,
    label: attr.label || key, // Use label, fallback to key
    value: attr.value || 0,   // Default value is 0
    type: attr.type || 'attribute',
  }));


  function parseAttributeLabel(fullLabel) {
    if (!fullLabel) return 'Unnamed';
    const match = fullLabel.match(/\.([^\.]+)$/); // Match after last period
    let base = match ? match[1] : fullLabel;
    if (base.length > 0) {
      base = base[0].toUpperCase() + base.slice(1); // Capitalize first letter
    }
    return base;
  }


  const attributeDiamondsHTML = attributesArr.map(attr => {
    const label = parseAttributeLabel(attr.label);
    const ranking = attr.value;
    const tn = 20 - ranking;

    return `
      <div class="attr-diamond-wrapper">
        <div class="attr-label">${label}</div>
        <div class="diamond">
          <div class="diamond-value">${tn}</div>
          <div class="small-diamond">
            <div class="small-diamond-value">${ranking}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');


  const attributesSectionHTML = `
    <section class="attributes-section">
      <h2>Attributes</h2>
      <div class="attribute-row">
        ${attributeDiamondsHTML}
      </div>
    </section>
  `;

  sheetDiv.innerHTML += attributesSectionHTML;


  // 5) SKILLS (similar logic to before)
  // We assume data.system?.commonSkills might be an object or array
  let commonSkills = data.system?.commonSkills;
  if (commonSkills && !Array.isArray(commonSkills)) {
    // Convert to array of [key, skillData]
    commonSkills = Object.entries(commonSkills).map(([skillKey, skillData]) => ({
      skillKey,
      ...skillData
    }));
  }
  if (!commonSkills) commonSkills = [];

  // Filter & sort by associatedAttribute
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
  function parseSkillLabel(label) {
    if (!label) return 'Unnamed';
    // e.g. "tor2e.commonSkills.enhearten" => "enhearten" => "Enhearten"
    const match = label.match(/\.([^\.]+)$/);
    let base = match ? match[1] : label;
    if (base.length > 0) {
      base = base[0].toUpperCase() + base.slice(1);
    }
    return base;
  }

  function buildSkillHTML(skill) {
  const isFavoured = skill.favoured?.value || false; // Safely access the "value" property
  const favouredSymbol = isFavoured ? '★' : '○'; // Star for favoured, hollow circle for non-favoured

  // Parse and clean up the skill label
  const skillName = skill.label
    ? parseSkillLabel(skill.label)
    : (skill.skillKey || 'Unnamed');

  // Build the rating display with filled and empty squares
  const rating = skill.value || 0;
  const clamped = Math.max(0, Math.min(rating, 6));
  const filled = '■'.repeat(clamped);
  const empty = '□'.repeat(6 - clamped);

  // Construct the skill line
  return `
    <div class="skill-line">
      ${favouredSymbol} <button class="roll-button" data-skill="${skillName}" data-favoured="${isFavoured}" data-value="${rating}">${skillName}</button>: ${filled}${empty}
    </div>
  `;
}


  const skillsSectionHTML = `
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

  // 6) Combat Section

      // Helper: Render Combat Items with detailed rows
      function renderCombatItems(items) {
        return items.map(item => {
          const { name, type, damage, injury, load, qualities, banes, notes } = item;

          // Wrap terms with tooltips
          const wrapWithTooltip = text => {
            return text
              .split(' ')
              .map(term =>
                tooltips[term]
                  ? `<span class="tooltip" title="${tooltips[term]}">${term}</span>`
                  : term
              )
              .join(' ');
          };

          return `
            <tr>
              <td>${name || '-'}</td>
              <td>${type || '-'}</td>
              <td>${damage || '-'}</td>
              <td>${injury || '-'}</td>
              <td>${load || '-'}</td>
              <td>${wrapWithTooltip(qualities || '-')}</td>
              <td>${wrapWithTooltip(banes || '-')}</td>
              <td>${notes || '-'}</td>
            </tr>
          `;
        }).join('');
      }

      // Generate the War Gear and Armor sections
      const warGearHTML = `
        <div class="combat-row war-gear">
          <h3>War Gear</h3>
          <table class="combat-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Damage</th>
                <th>Injury</th>
                <th>Load</th>
                <th>Qualities</th>
                <th>Banes</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${renderCombatItems([
                {
                  name: "Nurhael's Warden Blade",
                  type: "Long Sword",
                  damage: "5/9",
                  injury: "18/20",
                  load: "3",
                  qualities: "Fell Keen",
                  banes: "Evil Men, Undead",
                  notes: "Heir of Arnor: reforged by Brandor."
                },
                {
                  name: "Mithril Mail",
                  type: "Armor",
                  damage: "-",
                  injury: "-",
                  load: "0",
                  qualities: "Close-Fitting",
                  banes: "Orcs",
                  notes: "Forged by Balin and the Elves of Rivendell."
                }
              ])}
            </tbody>
          </table>
        </div>
      `;


      const armorHTML = `
        <div class="combat-row armour">
          <h3>Armour</h3>
          <ul>
            <li>Mithril Mail (Load: 0)</li>
            <li>Helm (Load: 2)</li>
            <li>North Star-Cloak (Load: 1)</li>
          </ul>
        </div>
      `;


  const combatSectionHTML = `
    <section class="combat-section">
      <h2>Combat</h2>
      <div class="combat-grid">
        <!-- Proficiencies -->
        <div class="combat-column proficiencies">
          <h3>Proficiencies</h3>
          <ul>
            <li>Axes: ■□□□</li>
            <li>Bows: ■■■□□□</li>
            <li>Spears: ■□□□□□</li>
            <li>Swords: ■■■■□□</li>
          </ul>
        </div>

        <!-- Parry and Protection -->
        <div class="combat-column parry-protection">
          <h3>Parry</h3>
          <div class="stat-block">
            <span class="big-number">${data.system?.combatAttributes?.parry?.value || 0}</span>
          </div>
          <h3>Protection</h3>
          <div class="stat-block">
            <span class="big-number">${data.system?.resources?.protection?.value || '0d'}</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="combat-column notes">
          <h3>Notes</h3>
          <p>${data.system?.combatAttributes?.notes?.value || '-'}</p>
        </div>
      </div>

      ${warGearHTML} <!-- Include War Gear Table -->
      ${armorHTML} <!-- Include Armor List -->
    </section>
  `;

  // Gear, Treasure, and Artefacts Section
  const gearSection = document.createElement('section');
  gearSection.classList.add('gear-section');

  gearSection.innerHTML = `
    <div class="gear">
      <h3>Gear</h3>
      <ul>
        ${data.items
          .filter(item => item.type === 'weapon' || item.type === 'armour')
          .map(gear => `<li>${gear.name}</li>`)
          .join('')}
      </ul>
    </div>
    <div class="treasure">
      <h3>Treasure</h3>
      <p>Value: ${data.system.treasure.value || '0'}</p>
    </div>
    <div class="artefacts">
      <h3>Marvelous Artefacts</h3>
      <ul>
        <li>Blessing: <input type="text" placeholder="Enter blessing..." /></li>
      </ul>
      <h3>Wondrous Items</h3>
      <ul>
        <li>Blessing 1: <input type="text" placeholder="Enter blessing..." /></li>
        <li>Blessing 2: <input type="text" placeholder="Enter blessing..." /></li>
      </ul>
    </div>
  `;

  sheetDiv.appendChild(gearSection);


  // Combine everything
  sheetDiv.innerHTML = `
    ${headerHTML}
    ${infoGridHTML}
    ${attributesSectionHTML}
    ${skillsSectionHTML}
    ${combatSectionHTML}
  `;

  jsonContainerElem.appendChild(sheetDiv);

  document.addEventListener('click', event => {
    if (event.target.classList.contains('roll-button')) {
      const skillName = event.target.dataset.skill;
      const favoured = event.target.dataset.favoured === "true";
      const ranking = parseInt(event.target.dataset.value, 10);

      const associatedAttribute = "Heart"; // Example; dynamically fetch this if available
      const targetNumber = 17; // Example target number for Heart

      // Prompt for advantage/disadvantage
      const advantage = parseInt(prompt("Enter advantage (+) or disadvantage (-):", "0"), 10) || 0;

      // Roll skill
      const result = rollSkill({ value: ranking, favoured }, associatedAttribute, ["weary"], advantage);

      // Log results
      logResult(`
        <strong>${skillName}</strong> Roll:<br>
        Rolls: ${result.rolls.join(", ")}<br>
        Total: ${result.total}<br>
        Target: ${targetNumber}<br>
        ${result.total >= targetNumber ? "Success!" : "Failure."}
      `);
    }
  });

  function logResult(message) {
    const log = document.getElementById('log');
    const logEntry = document.createElement('li');
    logEntry.innerHTML = message;
    log.appendChild(logEntry);

    // Scroll to the bottom of the log
    log.scrollTop = log.scrollHeight;
  }


}
