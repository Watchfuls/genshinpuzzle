import Sword from "../assets/weapons/Sword.webp";
import Claymore from "../assets/weapons/Claymore.webp";
import Polearm from "../assets/weapons/Polearm.webp";
import Bow from "../assets/weapons/Bow.webp";
import Catalyst from "../assets/weapons/Catalyst.webp";
import region0 from "../assets/regions/Mondstadt.webp";
import region1 from "../assets/regions/Liyue.webp";
import region2 from "../assets/regions/Inazuma.webp";
import region3 from "../assets/regions/Sumeru.webp";
import region4 from "../assets/regions/Fontaine.webp";
import region5 from "../assets/regions/Natlan.webp";
import region6 from "../assets/regions/Nod-Krai.webp";
import region7 from "../assets/regions/Snezhnaya.webp";
export const weaponIcons: Record<string, string> = { Sword, Claymore, Polearm, Bow, Catalyst };
export const regionIcons: Record<string, string> = {
  Mondstadt: region0,
  Liyue: region1,
  Inazuma: region2,
  Sumeru: region3,
  Fontaine: region4,
  Natlan: region5,
  "Nod-Krai": region6,
  Snezhnaya: region7,
};
