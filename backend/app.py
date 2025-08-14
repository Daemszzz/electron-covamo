from flask import Flask, jsonify
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)

USERNAME = os.getenv("COVAMO_USERNAME")
PASSWORD = os.getenv("COVAMO_PASSWORD")

@app.route('/api/zoek/<string:zoek_id>', methods=['GET'])
def zoek_voertuig(zoek_id):
    options = Options()
    options.add_argument("--headless")
    driver = webdriver.Firefox(options=options)

    try:
        driver.get("https://grid.covamo.be/login/")
        driver.find_element(By.ID, "inputUsername").send_keys(USERNAME)
        driver.find_element(By.ID, "inputPassword").send_keys(PASSWORD)
        driver.find_element(By.ID, "login-btn").click()

        driver.get("https://grid.covamo.be/wagens")
        wait = WebDriverWait(driver, 15)
        tweedehands_knop = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[@data-type='secondhand']"))
        )
        tweedehands_knop.click()

        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#cars-overview-secondhand ul")))
        wagens = driver.find_elements(By.CSS_SELECTOR, "#cars-overview-secondhand ul > li:not(.thead)")

        for wagen in wagens:
            spans = wagen.find_elements(By.TAG_NAME, "span")
            if not spans or len(spans) < 1:
                continue

            wagen_id = spans[0].text.strip()
            if wagen_id == zoek_id:
                wagen.click()

                wait.until(EC.presence_of_element_located((By.ID, "modelId")))

                def get_value(id):
                    try:
                        el = driver.find_element(By.ID, id)
                        return el.get_attribute("value").strip()
                    except:
                        return ""

                def get_select_text(id):
                    try:
                        select_elem = driver.find_element(By.ID, id)
                        selected_option = select_elem.find_element(By.CSS_SELECTOR, "option:checked")
                        return selected_option.text.strip()
                    except:
                        return ""

                dag = get_value("firstSubscription_day")
                maand = get_value("firstSubscription_month")
                jaar = get_value("firstSubscription_year")
                inschrijving_datum = f"{dag.zfill(2)}-{maand.zfill(2)}-{jaar}" if dag and maand and jaar else ""

                vat_raw = get_value("vatType")
                vatType = "BTW" if vat_raw == "1" else "Marge" if vat_raw == "2" else "Onbekend"

                return jsonify({
                    "id": get_value("identifier"),
                    "modelId": get_value("modelId"),
                    "model": get_select_text("modelId"),
                    "modelExecution": get_value("modelExecution"),
                    "color": get_value("color"),
                    "chassis": get_value("chassis"),
                    "inschrijving": inschrijving_datum,
                    "vatType": vatType,
                    "km": get_value("km"),
                    "remarks": get_value("remarks"),
                    "priceNet": get_value("priceNet"),
                    "priceDealer": get_value("priceDealer")
                })

        return jsonify({"error": "ID niet gevonden"}), 404

    except Exception as e:
        print("FOUT:", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        driver.quit()

if __name__ == "__main__":
    import sys

    port = 5001  # Prod port consistent met Electron
    for arg in sys.argv:
        if arg.startswith("--port="):
            port = int(arg.split("=")[1])

    # debug=False voor standalone executable
    app.run(host="0.0.0.0", port=port, debug=False)
