#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <HTTPClient.h>
#include <WiFi.h>

const char* ssid = "Zeniula";
const char* password = "M3gaSp0k0W1F1@";
String serverUrl = "http://172.20.10.2:5000/api/scan?uid=";

//RFID
#define RST_PIN 4  
#define SS_PIN  6 

//buzzer
#define BUZZER_PIN 1 

//oled
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1 // no reset
//standard address for i2c screen
#define SCREEN_ADDRESS 0x3C 

#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSansBold12pt7b.h>

MFRC522 rfid_reader(SS_PIN, RST_PIN);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  delay(1000); 

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);
  
  //screen init
  Wire.begin(10, 9);
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("OLED screen not found"));
    for(;;);
  }
  
  // WiFi connecting
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setFont(&FreeSans9pt7b);
  display.setTextSize(1);
  display.setCursor(0, 30);
  display.println("Connecting WiFi...");
  display.display();

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  //rfid innit
  SPI.begin(7, 5, 15, 6);
  rfid_reader.PCD_Init();

  showReadyScreen();
}

void loop() {
  if (!rfid_reader.PICC_IsNewCardPresent()) return;
  if (!rfid_reader.PICC_ReadCardSerial()) return;

  //read uid
  String uidString = "";
  for (byte i = 0; i < rfid_reader.uid.size; i++) {
    uidString += String(rfid_reader.uid.uidByte[i] < 0x10 ? "0" : "");
    uidString += String(rfid_reader.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase(); 

  Serial.println("Scanned UID: " + uidString);

  //scan to update the screen
  display.clearDisplay();
  display.setFont(&FreeSans9pt7b);
  display.setTextSize(1);
  display.setCursor(0, 30);
  display.println("Sending data...");
  display.display();

  //FLASK CONNECTION
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    String finalUrl = serverUrl + uidString; 
    
    Serial.println("Sending to URL: " + finalUrl);
    http.begin(finalUrl.c_str());
    
    //get request to my laptop
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      Serial.print("Python response code: ");
      Serial.println(httpResponseCode);
      //success beep
      digitalWrite(BUZZER_PIN, LOW); delay(150); digitalWrite(BUZZER_PIN, HIGH);
    } else {
      Serial.print("Sending error (is Python running?): ");
      Serial.println(httpResponseCode);
      //long beep - failed
      digitalWrite(BUZZER_PIN, LOW); delay(1000); digitalWrite(BUZZER_PIN, HIGH);
    }
    http.end();
  } else {
    Serial.println("No WiFi connection");
  }

  //UID display
  display.clearDisplay();
  int16_t x1, y1; uint16_t w, h;
  
  display.setFont(&FreeSans9pt7b);
  String header = "SCANNED:";
  display.getTextBounds(header, 0, 20, &x1, &y1, &w, &h);
  display.setCursor((128 - w) / 2, 20);
  display.println(header);

  display.getTextBounds(uidString, 0, 50, &x1, &y1, &w, &h);
  display.setCursor((128 - w) / 2, 50);
  display.println(uidString);
  display.display();

  delay(2000);
  rfid_reader.PICC_HaltA();
  showReadyScreen();
}

void showReadyScreen() {
  display.clearDisplay();
  display.setFont(&FreeSans9pt7b);
  display.setTextSize(1);
  int16_t x1, y1; uint16_t w, h;
  
  String t1 = "BRIDGE";
  display.getTextBounds(t1, 0, 25, &x1, &y1, &w, &h);
  display.setCursor((128 - w) / 2, 25);
  display.println(t1);

  String t2 = "WAITING FOR CARD";
  display.getTextBounds(t2, 0, 50, &x1, &y1, &w, &h);
  display.setCursor((128 - w) / 2, 50);
  display.println(t2);
  display.display();
}