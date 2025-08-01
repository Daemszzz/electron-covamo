<template>
  <div id="app">
    <h1>Zoek Tweedehands Wagen</h1>

    <form @submit.prevent="zoekWagen">
      <input v-model="zoekId" placeholder="Voer ID in" />
      <button :disabled="loading">Zoeken</button>
    </form>

    <div v-if="loading" class="loader-container">
      <div class="loader"></div>
      <p>Bezig met laden...</p>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="wagen" class="gele-fiche print-preview">
      <div class="fiche-grid">
        <div class="fiche-links-container">
          <div class="fiche-links">
            <div class="kader">
              <p>
                MERK
                <span
                  ><strong>{{ wagen.model }}</strong></span
                >
              </p>
              <p>
                TYPE
                <span
                  ><strong>{{ wagen.modelExecution }}</strong></span
                >
              </p>
              <p>
                KLEUR
                <span
                  ><strong>{{ wagen.color }}</strong></span
                >
              </p>
              <p>
                CHASSISNUMMER
                <span
                  ><strong>{{ wagen.chassis }}</strong></span
                >
              </p>
              <p>
                INSCHRIJVINGSDATUM
                <span
                  ><strong>{{ wagen.inschrijving }}</strong></span
                >
              </p>
              <p>
                VORIGE EIGENAAR
                <span
                  class="editable-text"
                  contenteditable="true"
                  spellcheck="false"
                  :inner-text="wagen.vorigeEigenaar"
                  @input="updateVorigeEigenaar"
                ></span>
              </p>
            </div>

            <div class="kader">
              <p>
                INSCHRIJVING
                <span
                  ><input type="checkbox" :checked="wagen.inschrijvingCheckbox"
                /></span>
              </p>
              <p>
                GELIJKVORMIGHEIDSATTEST
                <span
                  ><input
                    type="checkbox"
                    :checked="wagen.gelijkvormigheidsattest"
                /></span>
              </p>
              <p>
                KEURINGSKAART
                <span
                  ><input type="checkbox" :checked="wagen.keuringskaart"
                /></span>
              </p>
            </div>

            <div class="kader">
              <p>
                MARGE
                <span
                  ><input type="checkbox" :checked="wagen.vatType === 'Marge'"
                /></span>
              </p>
              <p>
                BTW
                <span
                  ><input type="checkbox" :checked="wagen.vatType === 'BTW'"
                /></span>
              </p>
            </div>
          </div>
        </div>

        <div class="fiche-rechts-container">
          <div class="fiche-rechts">
            <div class="kader idnummer">
              <p>ID NUMMER</p>
              <p class="groot">
                <strong>{{ wagen.id }}</strong>
              </p>
            </div>

            <div class="kader kmstand">
              <p>
                KM STAND
                <span
                  ><strong>{{ wagen.km }}</strong></span
                >
              </p>
            </div>

            <div class="kader opmerkingen">
              <p>Opmerkingen</p>
              <div class="opm-box">
                <strong>
                  <span
                    class="editable-text"
                    contenteditable="true"
                    spellcheck="false"
                    :inner-text="wagen.remarks"
                    @input="updateRemarks"
                  ></span>
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="prijzen-onderaan">
        <div class="prijzen-kader">
          <p>
            AK
            <span
              ><strong
                >€
                {{
                  parseFloat(wagen.priceDealer).toLocaleString("nl-BE", {
                    minimumFractionDigits: 2,
                  })
                }}</strong
              ></span
            >
          </p>
          <p>
            VK
            <span
              ><strong
                >€
                {{
                  parseFloat(wagen.priceNet).toLocaleString("nl-BE", {
                    minimumFractionDigits: 2,
                  })
                }}</strong
              ></span
            >
          </p>
        </div>
      </div>
    </div>

    <button @click="afdrukken">Afdrukken</button>
  </div>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";

const zoekId = ref("");
const wagen = ref(null);
const error = ref("");
const loading = ref(false);
const apiUrl = import.meta.env.VITE_API_URL;

const zoekWagen = async () => {
  error.value = "";
  wagen.value = null;
  loading.value = true;

  if (!zoekId.value.trim()) {
    error.value = "Voer een geldig ID in.";
    loading.value = false;
    return;
  }

  try {
    const response = await axios.get(`${apiUrl}/api/zoek/${zoekId.value}`);
    wagen.value = {
      ...response.data,
      vorigeEigenaar: "",
      inschrijvingCheckbox: false,
      gelijkvormigheidsattest: false,
      keuringskaart: false,
    };
  } catch (err) {
    error.value = "Voertuig niet gevonden of fout bij ophalen.";
  } finally {
    loading.value = false;
  }
};

const updateVorigeEigenaar = (e) => {
  wagen.value.vorigeEigenaar = e.target.innerText;
};

const updateRemarks = (e) => {
  wagen.value.remarks = e.target.innerText;
};

const afdrukken = () => {
  window.print();
};
</script>

<style>
#app {
  background-color: #fff;
  color: #000;
}

.gele-fiche {
  margin-top: 10px;
  width: 210mm;
  height: 297mm;
  padding: 10mm;
  box-sizing: border-box;
  background: white;
  position: relative;
  display: flex;
  flex-direction: column;
}

.fiche-grid {
  display: flex;
  max-height: 120mm;
  flex: none;
}

.fiche-links-container,
.fiche-rechts-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.fiche-links,
.fiche-rechts {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.kader {
  border: 1px solid #000;
  padding: 1mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
}

.kader p {
  margin: 2mm 0;
  font-size: 10pt;
  display: flex;
  justify-content: space-between;
}

.fiche-rechts-container .kader p span,
.fiche-links-container .kader p span {
  font-weight: bold;
  display: block;
  text-align: left;
  width: 43%;
}

.idnummer .groot {
  font-size: 24pt;
  font-weight: bold;
}

.opmerkingen .opm-box {
  border: 1px solid #000;
  padding: 3mm;
  margin-top: 2mm;
  flex: 1;
  min-height: 30mm;
  font-size: 10pt;
}

.prijzen-onderaan {
  position: absolute;
  bottom: 10mm;
  left: 10mm;
}

.prijzen-kader {
  border: 1px solid #000;
  width: 60mm;
  padding: 4mm;
}

.prijzen-kader p {
  display: flex;
  justify-content: space-between;
  margin: 2mm 0;
  font-size: 11pt;
}

.editable-text {
  display: inline-block;
  min-width: 100px;
  border: 1px dashed #aaa;
  background-color: #f9f9f9;
  font-weight: bold;
  outline: none;
  direction: ltr;
  white-space: pre-wrap;
}

.editable-text:focus {
  border: 1px solid #333;
  background-color: #fff;
}

@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    place-items: initial !important;
    min-height: auto !important;
    background: white !important;
    color: black !important;
  }

  form,
  button,
  h1 {
    display: none !important;
  }

  #app {
    margin: 0;
    padding: 0;
    max-width: none;
  }

  .gele-fiche {
    width: 210mm;
    height: 297mm;
    padding: 0;
    box-sizing: border-box;
    background: white;
    color: black;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .fiche-grid {
    display: flex;
    flex-direction: row;
    flex: 1;
    margin: 0;
    padding: 0;
  }

  .fiche-links-container,
  .fiche-rechts-container {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .fiche-links,
  .fiche-rechts {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .prijzen-onderaan {
    position: absolute;
  }

  .prijzen-kader {
    border: 1px solid black;
    width: 60mm;
    padding: 4mm;
    margin: 0;
  }

  .prijzen-kader p {
    display: flex;
    justify-content: space-between;
    font-size: 11pt;
  }

  .editable-text {
    border: none;
    background: transparent;
  }
}

@media screen {
  .gele-fiche {
    width: 250mm;
  }
}
</style>
