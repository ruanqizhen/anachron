import { useState, useRef, useEffect } from 'react';

interface EthnicGroup {
  id: string;
  name: string;
  alias?: string;
  start: number;
  end: number;
  x: number;
  lane: 'isolated' | 'mongolic' | 'turkic' | 'tungusic' | 'qiang' | 'cultural';
  lang: string;
  polities: string[];
  desc: string;
  highlight?: boolean;
}

interface Edge {
  from: string;
  to: string;
  type?: 'cultural' | 'merge';
  label?: string;
}

const Rl = -350;
const Wc = 1720;
const ni = 2.15;

const Ac: EthnicGroup[] = [
  { id: "xiongnu", name: "匈奴", alias: "Xiongnu", start: -209, end: 155, x: 4.5, lane: "isolated", lang: "混合·匈奴语", polities: ["匈奴帝国 209BC-48AD", "北匈奴西迁"], desc: "部分融入鲜卑、丁零；阿提拉匈人存疑", highlight: true },
  { id: "jie", name: "羯", alias: "Jie", start: 304, end: 352, x: 6.5, lane: "isolated", lang: "中亚-羌渠?", polities: ["后赵 319-351", "石勒建国"], desc: "冉闵灭羯，残部融入汉地" },
  { id: "sogdian", name: "粟特", alias: "Sogdian", start: 150, end: 850, x: 56, lane: "cultural", lang: "东伊朗语", polities: ["丝路商团", "文字之师"], desc: "粟特文 → 回鹘文 → 蒙古文", highlight: true },
  { id: "donghu", name: "东胡", alias: "Donghu", start: -300, end: -150, x: 18, lane: "mongolic", lang: "古蒙古语", polities: ["东胡联盟"], desc: "被冒顿单于击败后分化", highlight: true },
  { id: "wuhuan", name: "乌桓", alias: "Wuhuan", start: -150, end: 207, x: 9, lane: "mongolic", lang: "蒙古语", polities: ["乌桓山诸部"], desc: "207年被曹操击破，融入汉、鲜卑" },
  { id: "xianbei", name: "鲜卑", alias: "Xianbei", start: -100, end: 310, x: 21, lane: "mongolic", lang: "鲜卑语", polities: ["檀石槐联盟 155-181"], desc: "东胡正统，草原共主", highlight: true },
  { id: "murong", name: "慕容鲜卑", alias: "Murong", start: 281, end: 410, x: 12, lane: "mongolic", lang: "鲜卑语", polities: ["前燕 337-370", "后燕 384-409"], desc: "入主中原，汉化最早" },
  { id: "tuoba", name: "拓跋鲜卑", alias: "Tuoba", start: 315, end: 534, x: 24, lane: "mongolic", lang: "鲜卑语", polities: ["代 315-376", "北魏 386-534", "孝文汉化"], desc: "北魏统一北方", highlight: true },
  { id: "yuwen", name: "宇文鲜卑", alias: "Yuwen", start: 340, end: 581, x: 33, lane: "mongolic", lang: "鲜卑语", polities: ["西魏 535-557", "北周 557-581"], desc: "府兵制创立者" },
  { id: "tuyuhun", name: "吐谷浑", alias: "Tuyuhun", start: 284, end: 670, x: 74, lane: "mongolic", lang: "鲜卑语+羌", polities: ["吐谷浑汗国 青海"], desc: "鲜卑在青藏高原的分支" },
  { id: "kumoXi", name: "库莫奚/奚", alias: "Kumo Xi", start: 386, end: 906, x: 42, lane: "mongolic", lang: "蒙古语", polities: ["饶乐都督府"], desc: "契丹近亲，后融入契丹" },
  { id: "rouran", name: "柔然", alias: "Rouran", start: 330, end: 555, x: 30, lane: "mongolic", lang: "蒙古语", polities: ["柔然汗国 330-555"], desc: "被突厥所灭，西迁为阿瓦尔?", highlight: true },
  { id: "avar", name: "阿瓦尔", alias: "Avar", start: 555, end: 810, x: 8, lane: "mongolic", lang: "蒙古语?", polities: ["欧洲阿瓦尔汗国 567-804"], desc: "柔然后裔假说，冲击东欧" },
  { id: "shiwei", name: "室韦", alias: "Shiwei", start: 550, end: 1150, x: 38, lane: "mongolic", lang: "古蒙古语", polities: ["大兴安岭诸部"], desc: "蒙古人直系祖先" },
  { id: "khitan", name: "契丹", alias: "Khitan", start: 388, end: 1218, x: 26, lane: "mongolic", lang: "契丹语", polities: ["辽 907-1125", "西辽 1124-1218"], desc: "创契丹大字小字", highlight: true },
  { id: "daur", name: "达斡尔", alias: "Daur", start: 1200, end: 1700, x: 54, lane: "mongolic", lang: "蒙古语", polities: ["契丹遗民"], desc: "契丹后裔之一" },
  { id: "mongol", name: "蒙古", alias: "Mongols", start: 1130, end: 1368, x: 40, lane: "mongolic", lang: "蒙古语", polities: ["蒙古帝国 1206-1259", "元 1271-1368"], desc: "成吉思汗统一草原", highlight: true },
  { id: "tatars", name: "鞑靼·东蒙古", alias: "Tatar", start: 1368, end: 1635, x: 35, lane: "mongolic", lang: "蒙古语", polities: ["北元 1368-1388", "鞑靼本部"], desc: "黄金家族东支" },
  { id: "oirat", name: "瓦剌·卫拉特", alias: "Oirat", start: 1399, end: 1755, x: 50, lane: "mongolic", lang: "卫拉特语", polities: ["瓦剌 1400-1635", "准噶尔 1635-1755"], desc: "西蒙古，创托忒文" },
  { id: "dingling", name: "丁零", alias: "Dingling", start: -200, end: 300, x: 46, lane: "turkic", lang: "突厥语?", polities: ["贝加尔湖诸部"], desc: "最早的突厥系记录" },
  { id: "gaoche", name: "高车", alias: "Gaoche", start: 300, end: 540, x: 48, lane: "turkic", lang: "突厥语", polities: ["袁纥部为王"], desc: "丁零别名，车轮高大" },
  { id: "tiele", name: "铁勒", alias: "Tiele", start: 500, end: 630, x: 52, lane: "turkic", lang: "突厥语", polities: ["十五部", "薛延陀、回纥等"], desc: "突厥汗国主体部落" },
  { id: "ashina", name: "阿史那·突厥", alias: "Ashina", start: 552, end: 582, x: 53, lane: "turkic", lang: "突厥语", polities: ["突厥汗国 552-582"], desc: "王族出自铁勒", highlight: true },
  { id: "eastTurk", name: "东突厥", alias: "East Turk", start: 582, end: 744, x: 49, lane: "turkic", lang: "突厥语", polities: ["东突厥汗国 582-630,682-744"], desc: "毗伽可汗、阙特勤碑" },
  { id: "westTurk", name: "西突厥", alias: "West Turk", start: 582, end: 657, x: 60, lane: "turkic", lang: "突厥语", polities: ["西突厥汗国 582-657", "十姓部落"], desc: "控制丝绸之路" },
  { id: "xueyantuo", name: "薛延陀", alias: "Xueyantuo", start: 628, end: 646, x: 42, lane: "turkic", lang: "突厥语", polities: ["薛延陀汗国 629-646"], desc: "贞观年间称雄漠北" },
  { id: "huihe", name: "回纥/回鹘", alias: "Uyghur", start: 744, end: 840, x: 51, lane: "turkic", lang: "古回鹘语", polities: ["回鹘汗国 744-840"], desc: "摩尼教汗国，后西迁", highlight: true },
  { id: "ganzhou", name: "甘州回鹘", alias: "Ganzhou", start: 848, end: 1036, x: 68, lane: "turkic", lang: "回鹘语", polities: ["甘州 848-1036", "今裕固族"], desc: "河西走廊" },
  { id: "gaochang", name: "高昌回鹘", alias: "Qocho", start: 843, end: 1368, x: 61, lane: "turkic", lang: "回鹘语", polities: ["高昌回鹘 843-1335"], desc: "创回鹘文，佛教繁荣" },
  { id: "karakhanid", name: "喀喇汗·西回鹘", alias: "Karakhanid", start: 840, end: 1212, x: 70, lane: "turkic", lang: "喀喇汗语", polities: ["喀喇汗朝 840-1212"], desc: "首个伊斯兰化突厥王朝" },
  { id: "chuyue", name: "处月", alias: "Chuyue", start: 600, end: 800, x: 62, lane: "turkic", lang: "突厥语", polities: ["西突厥别部"], desc: "沙陀祖先" },
  { id: "gelulu", name: "葛逻禄", alias: "Karluk", start: 650, end: 1130, x: 68.5, lane: "turkic", lang: "葛逻禄语", polities: ["葛逻禄 650-1212"], desc: "怛罗斯之战关键" },
  { id: "kangli", name: "康里", alias: "Kangli", start: 1000, end: 1220, x: 65, lane: "turkic", lang: "钦察语", polities: ["康里部"], desc: "后融入钦察、哈萨克" },
  { id: "shatuo", name: "沙陀", alias: "Shatuo", start: 808, end: 950, x: 36, lane: "turkic", lang: "突厥语", polities: ["沙陀三部"], desc: "处月后裔，入居中原", highlight: true },
  { id: "laterTang", name: "后唐", alias: "Later Tang", start: 923, end: 936, x: 32, lane: "turkic", lang: "突厥-汉", polities: ["后唐 923-936 李存勖"], desc: "沙陀建五代第一朝" },
  { id: "laterJin", name: "后晋·后汉", alias: "Later Jin/Han", start: 936, end: 951, x: 29, lane: "turkic", lang: "突厥-汉", polities: ["后晋 936-947", "后汉 947-951"], desc: "石敬瑭割燕云十六州" },
  { id: "sushen", name: "肃慎", alias: "Sushen", start: -700, end: -200, x: 82, lane: "tungusic", lang: "古通古斯语", polities: ["肃慎氏"], desc: "最早东北民族" },
  { id: "yilou", name: "挹娄", alias: "Yilou", start: -200, end: 300, x: 84, lane: "tungusic", lang: "通古斯语", polities: ["挹娄国"], desc: "肃慎后裔" },
  { id: "wuji", name: "勿吉", alias: "Wuji", start: 300, end: 500, x: 83, lane: "tungusic", lang: "通古斯语", polities: ["勿吉七部"], desc: "南北朝时强大" },
  { id: "mohe", name: "靺鞨七部", alias: "Mohe", start: 400, end: 700, x: 80, lane: "tungusic", lang: "靺鞨语", polities: ["粟末、白山、黑水等"], desc: "勿吉后裔分化", highlight: true },
  { id: "sumo", name: "粟末靺鞨", alias: "Sumo Mohe", start: 550, end: 700, x: 72, lane: "tungusic", lang: "靺鞨语", polities: ["粟末部"], desc: "渤海国主族" },
  { id: "bohai", name: "渤海国", alias: "Bohai", start: 698, end: 926, x: 73, lane: "tungusic", lang: "靺鞨-汉", polities: ["渤海 698-926", "海东盛国"], desc: "粟末靺鞨+高句丽遗民", highlight: true },
  { id: "heishui", name: "黑水靺鞨", alias: "Heishui", start: 500, end: 1000, x: 84.5, lane: "tungusic", lang: "女真语前身", polities: ["黑水都督府"], desc: "女真直系" },
  { id: "jurchen", name: "女真", alias: "Jurchen", start: 1000, end: 1234, x: 81, lane: "tungusic", lang: "女真语", polities: ["金 1115-1234"], desc: "完颜阿骨打建国", highlight: true },
  { id: "manchu", name: "满洲", alias: "Manchu", start: 1616, end: 1720, x: 79, lane: "tungusic", lang: "满语", polities: ["后金 1616-1636", "清 1636-1912"], desc: "建州女真，创满文", highlight: true },
  { id: "ancientQiang", name: "古羌", alias: "Ancient Qiang", start: -1000, end: 100, x: 92, lane: "qiang", lang: "羌语支", polities: ["发羌、唐旄等"], desc: "藏缅语族祖先", highlight: true },
  { id: "di", name: "氐", alias: "Di", start: 100, end: 500, x: 88, lane: "qiang", lang: "氐羌语", polities: ["成汉 304-347", "前秦 351-394", "后凉 386-403", "仇池 296-442"], desc: "苻坚统一北方" },
  { id: "dangxiangQiang", name: "党项羌", alias: "Dangxiang", start: 400, end: 800, x: 90, lane: "qiang", lang: "党项语", polities: ["党项八部"], desc: "羌族西迁后裔" },
  { id: "tubo", name: "吐蕃", alias: "Tubo", start: 618, end: 842, x: 93, lane: "qiang", lang: "古藏语", polities: ["吐蕃帝国 618-842", "松赞干布"], desc: "发羌后裔，创藏文", highlight: true },
  { id: "tangut", name: "党项·西夏", alias: "Tangut", start: 982, end: 1227, x: 87, lane: "qiang", lang: "西夏语", polities: ["西夏 1038-1227"], desc: "创西夏文，佛教王国" },
  { id: "tibetan", name: "藏·诸部", alias: "Tibetan", start: 842, end: 1650, x: 94, lane: "qiang", lang: "藏语支", polities: ["古格、萨迦等"], desc: "吐蕃分裂后诸部" }
];

const Nm: Edge[] = [
  { from: "donghu", to: "wuhuan" }, { from: "donghu", to: "xianbei" }, { from: "xianbei", to: "murong" }, { from: "xianbei", to: "tuoba" }, { from: "xianbei", to: "yuwen" }, { from: "xianbei", to: "tuyuhun" }, { from: "xianbei", to: "kumoXi" }, { from: "xianbei", to: "rouran" }, { from: "xianbei", to: "shiwei" }, { from: "xianbei", to: "khitan" }, { from: "rouran", to: "avar" }, { from: "shiwei", to: "mongol" }, { from: "mongol", to: "tatars" }, { from: "mongol", to: "oirat" }, { from: "khitan", to: "daur" }, { from: "dingling", to: "gaoche" }, { from: "gaoche", to: "tiele" }, { from: "tiele", to: "ashina" }, { from: "tiele", to: "xueyantuo" }, { from: "tiele", to: "huihe" }, { from: "ashina", to: "eastTurk" }, { from: "ashina", to: "westTurk" }, { from: "westTurk", to: "chuyue" }, { from: "westTurk", to: "gelulu" }, { from: "westTurk", to: "kangli" }, { from: "chuyue", to: "shatuo" }, { from: "shatuo", to: "laterTang" }, { from: "shatuo", to: "laterJin" }, { from: "huihe", to: "ganzhou" }, { from: "huihe", to: "gaochang" }, { from: "huihe", to: "karakhanid" }, { from: "sushen", to: "yilou" }, { from: "yilou", to: "wuji" }, { from: "wuji", to: "mohe" }, { from: "mohe", to: "sumo" }, { from: "mohe", to: "heishui" }, { from: "sumo", to: "bohai" }, { from: "heishui", to: "jurchen" }, { from: "jurchen", to: "manchu" }, { from: "ancientQiang", to: "di" }, { from: "ancientQiang", to: "dangxiangQiang" }, { from: "ancientQiang", to: "tubo" }, { from: "dangxiangQiang", to: "tangut" }, { from: "tubo", to: "tibetan" }, { from: "xiongnu", to: "jie" }, { from: "sogdian", to: "huihe", type: "cultural", label: "粟特文字" }, { from: "huihe", to: "mongol", type: "cultural", label: "回鹘式蒙古文" }, { from: "sogdian", to: "gaochang", type: "cultural" }, { from: "xiongnu", to: "donghu", type: "merge", label: "冒顿破东胡" }, { from: "xiongnu", to: "dingling", type: "merge" }
];

const ur = {
  mongolic: { label: "蒙古语系·东胡线", color: "#7fb4ff", bg: "bg-blue-500/10", border: "border-blue-400" },
  turkic: { label: "突厥语系·丁零线", color: "#ff8c4b", bg: "bg-orange-500/10", border: "border-orange-400" },
  tungusic: { label: "通古斯语系·肃慎线", color: "#4ade80", bg: "bg-emerald-500/10", border: "border-emerald-400" },
  qiang: { label: "羌藏语系·古羌线", color: "#c4a0ff", bg: "bg-violet-500/10", border: "border-violet-400" },
  isolated: { label: "孤立/混合·匈奴-羯", color: "#9ca3af", bg: "bg-zinc-500/10", border: "border-zinc-400" },
  cultural: { label: "文化桥梁·粟特", color: "#facc15", bg: "bg-yellow-500/10", border: "border-yellow-400" }
};

function Ll(year: number) {
  return (year - Rl) * ni;
}

function ti(year: number) {
  if (year < 0) return `公元前${Math.abs(year)}年`;
  if (year === 0) return "公元元年";
  return `${year}年`;
}

const startYear = Math.ceil(Rl / 200) * 200;
const endYear = Math.floor(Wc / 200) * 200;
const years: number[] = [];
for (let y = startYear; y <= endYear; y += 200) {
  years.push(y);
}

export default function Ethnic() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(980);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef({ screenX: 0, screenY: 0, scrollLeft: 0, scrollTop: 0 });
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!scrollContainerRef.current) return;
    
    setIsMouseDown(true);
    isDragging.current = false;
    dragStart.current = {
      screenX: e.screenX,
      screenY: e.screenY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: window.scrollY
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !scrollContainerRef.current) return;
    
    const dx = e.screenX - dragStart.current.screenX;
    const dy = e.screenY - dragStart.current.screenY;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDragging.current = true;
    }
    
    if (isDragging.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
      window.scrollTo(window.scrollX, dragStart.current.scrollTop - dy);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
    setTimeout(() => {
      isDragging.current = false;
    }, 50);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      const innerContainer = containerRef.current?.querySelector('.custom-scroll > div');
      if (innerContainer) {
        setContainerWidth(innerContainer.clientWidth);
      } else if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    
    const innerContainer = containerRef.current.querySelector('.custom-scroll > div');
    if (innerContainer) {
      resizeObserver.observe(innerContainer);
    } else {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  const height = (Wc - Rl) * ni + 160;
  const activeId = lockedId ?? hoveredId;
  const getGroupById = (id: string) => Ac.find((c) => c.id === id);

  return (
    <div className="min-h-screen bg-[#0c0b09] text-[#e8e0d0] selection:bg-amber-200/30 overflow-x-hidden">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;800&family=JetBrains+Mono:wght@400&display=swap');
          * { font-family: "Noto Serif SC", serif; }
          .mono { font-family: "JetBrains Mono", monospace; }
          .custom-scroll::-webkit-scrollbar {
            height: 6px;
          }
          .custom-scroll::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
          }
          .custom-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
          }
          .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
          }
        `}
      </style>

      {/* Decorative Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#0e0c0a]" />
        <div 
          className="absolute inset-0 opacity-[0.07]" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 via-transparent to-violet-900/10" />
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0c0b09]/80 border-b border-white/10">
          <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-5 md:py-7 flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h1 className="text-[22px] md:text-[34px] font-[800] tracking-[0.12em] leading-[1.1] text-[#f5efe3]">
                  从匈奴到蒙古：北方民族传承总谱
                </h1>
                <p className="mt-2 text-[12px] md:text-[14px] tracking-[0.35em] text-[#c9b99a] uppercase">
                  四条血脉，千年更替 · 200BC — 1600AD
                </p>
              </div>
              <div className="text-[11px] leading-5 text-[#9a8d75] max-w-[420px] mono">
                悬停查看政权与后裔 · 实线=血缘继承 · 虚线=文化/文字传承 · 卡片点击锁定
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 md:gap-3">
              {Object.entries(ur).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: value.color, boxShadow: `0 0 8px ${value.color}` }} />
                  <span className="text-[11px] md:text-[12px] tracking-wide text-[#d9cfb8]">{value.label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="mx-auto max-w-[1600px] px-0 md:px-4">
          <div ref={containerRef} className="relative mt-2 md:mt-4 rounded-none md:rounded-[18px] border border-white/[0.06] bg-[#14120f]/60 backdrop-blur-sm overflow-hidden">
            <div className="sticky top-0 z-20 flex h-8 items-center border-b border-white/10 bg-[#0f0e0c]/90 px-[72px] text-[10px] tracking-widest text-[#8a7e66] mono">
              <div className="hidden md:flex gap-8">
                <span>⟵ 西迁/草原西缘</span>
                <span className="opacity-30">·</span>
                <span>漠北·蒙古高原</span>
                <span className="opacity-30">·</span>
                <span>河西·西域</span>
                <span className="opacity-30">·</span>
                <span>东北·白山黑水 ⟶</span>
                <span className="opacity-30">·</span>
                <span>青藏高原 ⟶</span>
              </div>
              <div className="md:hidden">向右横滑查看全谱 · 双指缩放查看细节</div>
            </div>

            {/* Left Year Scale Column */}
            <div 
              className="absolute left-0 top-8 bottom-0 z-20 w-[56px] border-r border-white/10 bg-[#0c0b09]/95 backdrop-blur-sm pointer-events-none"
            >
              {years.map((p) => {
                const h = Ll(p);
                return (
                  <div 
                    key={p} 
                    className="absolute right-0 -translate-y-1/2 pr-3 text-[10px] mono text-[#c9b99a] font-semibold"
                    style={{ top: h }}
                  >
                    {ti(p).replace("公元", "").replace("年", "")}
                  </div>
                );
              })}
              <div className="absolute right-[-1px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-200/30 to-transparent" />
            </div>

            <div 
              ref={scrollContainerRef}
              className={`relative overflow-x-auto overflow-y-hidden custom-scroll select-none ${isMouseDown ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              <div className="relative" style={{ width: "min(1600px, 140vw)", minWidth: "980px", height: height }}>
                {/* Horizontal grid lines for years */}
                <div className="absolute inset-0">
                  {years.map((p) => {
                    const h = Ll(p);
                    return (
                      <div key={p} className="absolute left-[120px] right-0 h-px bg-white/[0.06]" style={{ top: h }} />
                    );
                  })}
                </div>

                {/* Vertical split indicators */}
                <div className="absolute inset-y-0 left-[120px] right-0 flex">
                  {[18, 40, 62, 82].map((val) => (
                    <div key={val} className="h-full w-px bg-white/[0.04]" style={{ marginLeft: `${val}%` }} />
                  ))}
                </div>
                {/* SVG Connections */}
                <svg className="pointer-events-none absolute left-0 top-0 h-full w-full" style={{ left: 0 }}>
                  <defs>
                    {Object.entries(ur).map(([key, value]) => (
                      <linearGradient key={key} id={`grad-${key}`} x1="0" x2="1">
                        <stop offset="0%" stopColor={value.color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={value.color} stopOpacity={0.2} />
                      </linearGradient>
                    ))}
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {Nm.map((edge, idx) => {
                    const p = getGroupById(edge.from);
                    const h = getGroupById(edge.to);
                    if (!p || !h) return null;
                    const g = Ll(p.end) + 2;
                    const w = Ll(h.start) - 2;
                    if (w <= g) return null;

                    const isHighlighted = activeId && (edge.from === activeId || edge.to === activeId || p.id === activeId || h.id === activeId);
                    const isCultural = edge.type === 'cultural';
                    const isMerge = edge.type === 'merge';

                    const startX = 120 + (containerWidth - 120) * (p.x / 100);
                    const endX = 120 + (containerWidth - 120) * (h.x / 100);
                    const midY = (g + w) / 2;
                    const ctrlY1 = g + (w - g) * 0.35;
                    const ctrlY2 = w - (w - g) * 0.35;
                    const strokeColor = isCultural ? ur.cultural.color : ur[p.lane].color;

                    return (
                      <g key={idx}>
                        <path 
                          d={`M ${startX} ${g} C ${startX} ${ctrlY1}, ${endX} ${ctrlY2}, ${endX} ${w}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isHighlighted ? 2.6 : isCultural ? 1.4 : 1.2}
                          strokeOpacity={isHighlighted ? 0.9 : isCultural ? 0.55 : 0.38}
                          strokeDasharray={isCultural ? "6 6" : isMerge ? "3 5" : "0"}
                          filter={isHighlighted ? "url(#glow)" : undefined}
                          className="transition-all duration-300"
                        />
                        {edge.label && (
                          <text 
                            x={(startX + endX) / 2}
                            y={midY - 4}
                            textAnchor="middle"
                            fontSize="10"
                            fill={strokeColor}
                            opacity={isHighlighted ? 0.9 : 0.45}
                            className="mono"
                            style={{ paintOrder: "stroke", stroke: "#0c0b09", strokeWidth: 3 }}
                          >
                            {edge.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Nodes rendering */}
                {Ac.map((group) => {
                  const topPos = Ll(group.start);
                  const heightVal = Math.max(26, (group.end - group.start) * ni);
                  const isActive = activeId === group.id;
                  const m = ur[group.lane];
                  
                  return (
                    <div 
                      key={group.id}
                      className="absolute"
                      style={{ 
                        left: `calc(120px + (100% - 120px) * ${group.x / 100})`, 
                        top: topPos, 
                        transform: "translateX(-50%)", 
                        width: group.highlight ? "176px" : "148px", 
                        zIndex: isActive ? 30 : group.highlight ? 10 : 5 
                      }}
                      onMouseEnter={() => {
                        if (isDragging.current) return;
                        setHoveredId(group.id);
                      }}
                      onMouseLeave={() => {
                        if (isDragging.current) return;
                        setHoveredId(null);
                      }}
                      onClick={(e) => {
                        if (isDragging.current) {
                          e.stopPropagation();
                          return;
                        }
                        setLockedId((prev) => prev === group.id ? null : group.id);
                      }}
                    >
                      {/* Connection track line */}
                      <div 
                        className="absolute left-1/2 top-0 -z-10 w-[2px] -translate-x-1/2 rounded-full"
                        style={{ 
                          height: heightVal + 8, 
                          background: m.color, 
                          opacity: isActive ? 0.9 : 0.28, 
                          boxShadow: isActive ? `0 0 12px ${m.color}` : "none" 
                        }}
                      />
                      
                      {/* Node Box */}
                      <div 
                        className={`group relative cursor-pointer rounded-[10px] border bg-[#1b1915]/90 px-2.5 py-2 backdrop-blur-md transition-all duration-200 ${
                          isActive ? "scale-[1.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)]" : "hover:scale-[1.02]"
                        }`}
                        style={{ 
                          borderColor: isActive ? m.color : "rgba(255,255,255,0.12)", 
                          borderLeftWidth: "3px", 
                          borderLeftColor: m.color, 
                          boxShadow: isActive ? `0 0 0 1px ${m.color}40, 0 8px 24px rgba(0,0,0,0.5)` : undefined 
                        }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="leading-tight">
                            <div className={`text-[13px] font-[700] tracking-wide ${group.highlight ? "text-[#fff5e0]" : "text-[#e8ddd0]"}`}>
                              {group.name}
                            </div>
                            {group.alias && (
                              <div className="mono text-[9px] tracking-widest text-white/40">{group.alias}</div>
                            )}
                          </div>
                          <div 
                            className="rounded-full px-1.5 py-0.5 text-[8px] mono leading-none"
                            style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}
                          >
                            {group.lang.split("·")[0]}
                          </div>
                        </div>
                        
                        <div className="mt-1 flex items-center gap-1 text-[10px] mono text-[#9a8c74]">
                          <span>{ti(group.start)}</span>
                          <span className="opacity-40">—</span>
                          <span>{ti(group.end)}</span>
                        </div>

                        {/* Interactive panel */}
                        <div className={`grid transition-all duration-300 ${isActive ? "mt-2.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                          <div className="overflow-hidden">
                            <div className="rounded-[8px] bg-black/30 p-2.5 ring-1 ring-white/10">
                              <div className="space-y-2">
                                <div>
                                  <div className="text-[10px] tracking-widest text-white/40">政权 / 关键事件</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {group.polities.map((polity) => (
                                      <span key={polity} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-[#d6c8ad]">{polity}</span>
                                    ))}
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="text-[10px] tracking-widest text-white/40">传承与后裔</div>
                                  <div className="mt-1 text-[11px] leading-[1.5] text-[#c9bb9a]">{group.desc}</div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-1">
                                  <span className="mono text-[9px] text-white/30 font-sans">语言: {group.lang}</span>
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: m.color }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Read guidelines footer */}
            <div className="border-t border-white/10 bg-[#0f0e0c]/80 px-4 md:px-8 py-6">
              <div className="grid gap-6 md:grid-cols-[1.2fr_1fr_1fr]">
                <div>
                  <h4 className="text-[13px] font-semibold tracking-widest text-[#e8ddd0]">
                    读图指南 · 四条血脉如何分化
                  </h4>
                  <p className="mt-2 text-[12px] leading-6 text-[#a99c85]">
                    东胡线以<span className="text-[#7fb4ff]">蓝色</span>为主，从鲜卑分出慕容、拓跋、柔然、契丹直至蒙古；
                    丁零线以<span className="text-[#ff8c4b]">赤橙</span>为主，丁零→高车→铁勒→突厥→回鹘→沙陀建五代；
                    肃慎线以<span className="text-[#4ade80]">绿色</span>为主，靺鞨→渤海/女真→满洲；
                    古羌线以<span className="text-[#c4a0ff]">紫色</span>为主，发羌生吐蕃，党项建西夏。
                    灰色为匈奴-羯孤立支，黄线为文字传承。
                  </p>
                </div>
                
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3">
                  <div className="text-[11px] font-semibold tracking-widest text-[#facc15]">文字的丝路</div>
                  <div className="mt-2 text-[11px] leading-5 text-[#c9bb8a]">
                    粟特文（Sogdian）→ 回鹘文（Old Uyghur）→ 蒙古文（Mongolian Script）→ 满文（Manchu Script）。
                    <br />
                    这条黄线解释了为何草原帝国能跨越语言行政。
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] font-semibold tracking-widest text-[#d9cfb8]">学术备注</div>
                  <div className="mt-2 text-[11px] leading-5 text-[#9a8d75]">
                    • 匈奴语系归属仍有争议（突厥/蒙古/叶尼塞），此处标为混合。
                    <br />
                    • 羯人=匈奴羌渠分支，说法源自《魏书》，后赵石勒。
                    <br />
                    • 阿瓦尔=柔然为假说，主流未定论。
                    <br />
                    • 时间为概略，以政权兴衰为主。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <footer className="py-10 text-center text-[11px] tracking-[0.2em] text-white/30 mono">
          从匈奴到蒙古 · 四条血脉，千年更替 · 构建于 React / Tailwind · 无后端静态谱系
        </footer>
      </div>
    </div>
  );
}
