import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";

async function initializeUsers() {
  try {
    console.log("Kullanıcılar oluşturuluyor...");
    
    // Genel Sekreterlik hesabı - Gülbahar Öztürk
    const hashedPassword1 = await bcrypt.hash("47704699208", 10);
    await db.insert(users).values({
      tcNumber: "47704699208",
      password: hashedPassword1,
      firstName: "Gülbahar",
      lastName: "Öztürk",
      role: "genelsekreterlik",
      tableNumber: null
    }).onConflictDoNothing();
    
    // Genel Başkan hesabı - Yusuf İbiş
    const hashedPassword2 = await bcrypt.hash("46480904230", 10);
    await db.insert(users).values({
      tcNumber: "46480904230",
      password: hashedPassword2,
      firstName: "Yusuf",
      lastName: "İbiş",
      role: "genelbaskan",
      tableNumber: null
    }).onConflictDoNothing();
    
    console.log("Kullanıcılar başarıyla oluşturuldu!");
  } catch (error) {
    console.error("Kullanıcı oluşturma hatası:", error);
  }
}

// Eğer bu dosya doğrudan çalıştırılıyorsa
initializeUsers().then(() => process.exit(0));

export { initializeUsers };