#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

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

MFRC522 rfid_reader(SS_PIN, RST_PIN);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  delay(1000); 

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH); 
  Wire.begin(10, 9);
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("no OLED screen found"));
    for(;;);
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  
  //screen after init
  display.setCursor(10, 20);
  display.println("TEST");
  display.display();
  delay(1000);

  //RFID init
  SPI.begin(7, 5, 15, 6);
  rfid_reader.PCD_Init();

  Serial.println("\nSystem is ready");

  showReadyScreen();
}

void loop() {
  //looking for a new card
  if (!rfid_reader.PICC_IsNewCardPresent()) {
    return;
  }
  //choosing the card
  if (!rfid_reader.PICC_ReadCardSerial()) {
    return;
  }

  //uid reading
  String uidString = "";
  for (byte i = 0; i < rfid_reader.uid.size; i++) {
    uidString += String(rfid_reader.uid.uidByte[i] < 0x10 ? "0" : "");
    uidString += String(rfid_reader.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase(); 

  Serial.println("UID read: " + uidString);

//after successful read
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 10);
  display.println("SCANNED:");
  
  display.setTextSize(2);
  display.setCursor(0, 30);
  display.println(uidString);
  display.display();

  //buzzer beeep :)
  digitalWrite(BUZZER_PIN, LOW);
  delay(150);
  digitalWrite(BUZZER_PIN, HIGH);

  //timeout for the result
  delay(2000);

  rfid_reader.PICC_HaltA();

  showReadyScreen();
}

//screen ready for next read
void showReadyScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println("PUT YOUR CARD");
  display.setCursor(0, 40);
  display.println("AGAINST READER");
  display.display();
}