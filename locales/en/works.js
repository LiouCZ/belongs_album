(() => {
  const en = window.BELONGS_EN ||= {};
  const works = en.works ||= {};
  const namedWorks = [
    ["2022-invited-gold-b-ring", "全金B戒", "Solid Gold B Ring"],
    ["2024-invited-dragon-dog-tag", "龙·狗牌", "Dragon Dog Tag"],
    ["2024-invited-snake-square-tag", "蛇·方牌", "Serpent Square Tag"],
    ["2025-invited-gold-c-feather", "全金 C 羽", "Solid Gold C Feather"],
    ["2025-invited-snake-chain", "蛇骨链", "Serpent-Bone Chain"],
    ["2026-custom-gold-opal-coin", "全金镶嵌欧泊小金饼", "Small Solid Gold Medallion with Opal"],
    ["2026-custom-gold-wing-ring", "全金羽翼戒指", "Solid Gold Wings Ring"],
    ["2026-custom-goldtip-snake-chuxin-feather", "金蛇首先金初心羽", "Gold-Tipped Original Intention Feather with Gold Serpent Head"],
    ["2026-custom-l-cross", "L十字", "L Cross"],
    ["2026-display-antique-plate", "古董改造盘子", "Antique Rework: Plate"],
    ["2026-display-antique-snake-feather", "古董改造蛇羽", "Antique Rework: Serpent Feather"],
    ["2026-display-k-key", "K钥匙", "K Key"],
    ["2026-invited-eagle-square-tag", "鹰·方牌", "Eagle Square Tag"],
    ["2026-invited-goldtip-chuxin-feather", "先金初心羽", "Gold-Tipped Original Intention Feather"],
    ["2026-jinshe-chuxin-feather", "金蛇首初心羽", "Original Intention Feather with Gold Serpent Head"],
    ["2026-k-key", "K 钥匙", "K Key"],
    ["2026-xianjin-wing", "先金羽翼", "Gold-Tipped Wings"],
  ];
  for (const [id, source, translation] of namedWorks) {
    works[`upload:${id}`] = { title: { source, en: translation }, caption: { source: "", en: "" } };
  }
  const captions = {
    21: ["正面LOGO点金、背面唐草配鹰印主题雕刻。", "Gold-accented logo on the front. Scrolling vines and an eagle stamp carved on the reverse."],
    22: ["金花、唐草、金蕊", "Gold flower, scrolling vines and a gold flower center."],
    23: ["风景、鹰雕", "Landscape and eagle carving."],
    24: ["唐草金花", "Scrolling vines and a gold flower."],
  };
  let index = 0;
  for (let number = 1; number <= 30; number += 1) {
    const padded = String(number).padStart(2, "0");
    const [source, translation] = captions[number] || ["", ""];
    const photos = number <= 20 || number === 22 ? 1 : 2;
    for (let photo = 0; photo < photos; photo += 1) {
      index += 1;
      works[`player-wing-${padded}-${index}`] = {
        title: { source: `羽翼 #${padded}`, en: `Wings #${padded}` },
        caption: { source, en: translation },
      };
    }
  }
  Object.assign(en.text ||= {}, {
    "胸针": "Brooch", "耳钉": "Stud Earrings", "耳环": "Earrings",
    "Mini十字狗牌": "Mini Cross Dog Tag", "M镂空十字": "M Openwork Cross", "L十字": "L Cross", "M十字": "M Cross", "S十字": "S Cross",
    "大十字": "Large Cross", "中十字": "Medium Cross", "小十字": "Small Cross",
    "初心羽戒指": "Original Intention Feather Ring", "雏翼戒指": "Young Wings Ring", "羽翼戒指": "Wings Ring",
    "莫比乌斯戒指": "Mobius Ring", "平打戒指": "Flat-Forged Ring", "符节戒指": "Tally Ring", "马蹄戒指": "Horseshoe Ring",
    "B戒": "B Ring", "K戒": "K Ring", "方戒": "Square Ring", "戒指": "Rings",
    "平打宽手镯": "Wide Flat-Forged Cuff", "莫比乌斯手镯": "Mobius Cuff", "初心羽手镯": "Original Intention Feather Cuff", "平打手镯": "Flat-Forged Cuff", "手镯": "Cuffs",
    "蛇骨手链": "Serpent-Bone Bracelet", "蛇骨项链": "Serpent-Bone Necklace", "手链": "Bracelets", "角链": "Angular-Link Chain", "丸链": "Round-Link Chain", "银链": "Silver Chains", "项链": "Necklaces",
    "Mini金饼": "Mini Gold Medallion", "Mini银饼": "Mini Silver Medallion", "Mini金银饼": "Mini Gold and Silver Medallion",
    "熔币饼": "Melted-Coin Medallion", "古币饼": "Antique-Coin Medallion", "金饼": "Gold Medallions", "银饼": "Silver Medallions",
    "S羽翼": "S Wings", "贝贝羽": "Bebe Feather", "AB羽": "AB Feather", "C羽": "C Feather", "初心羽": "Original Intention Feather", "蛇羽": "Serpent Feather", "先金羽翼": "Gold-Tipped Wings", "羽翼": "Wings",
    "狗牌": "Dog Tags", "浮雕绳牌": "Relief Rope Tag", "缰绳牌": "Rein Tag", "合心牌": "Joined Hearts Tag", "方牌": "Square Tags", "茄形牌": "Aubergine-Shaped Tag", "银牌": "Silver Tags", "金牌": "Gold Tags",
    "鹰盾": "Eagle Shield", "鹰首": "Eagle Head", "马首": "Horse Head", "蛇首": "Serpent Head", "口哨": "Whistles", "十字": "Crosses", "吊坠": "Pendants",
    "包扣": "Bag Buckles", "莫比乌斯扣": "Mobius Clasp", "八字扣": "Figure-Eight Clasp", "花扣": "Flower Clasp", "皮带扣": "Belt Buckles", "扣饰": "Clasps and Buckles",
    "钥匙": "Keys", "银勺": "Silver Spoons", "盘子": "Plates", "如意夹": "Ruyi Clip", "钞票夹": "Money Clips", "牌夹": "Tag Clips", "方巾扣": "Scarf Rings", "珠饰": "Beads", "打火机": "Lighters", "印戳": "Stamps", "配饰": "Accessories", "其他图文": "Other Works",
  });
})();
