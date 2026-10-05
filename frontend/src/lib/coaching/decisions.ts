type Choice = { text: string; why: string; target: [number, number] };
export type Decision = { id: string; title: string; situation: string; player: [number, number]; opponent: [number, number]; answer: number; choices: Choice[]; lesson: string; pages: string };
export const decisions: Decision[] = [
  {
    id: "serve", title: "发球：先用可控目标开始", situation: "你在平分区准备一发，对手站位居中。今天用中等速度发向反手大区最稳定；追求边线时失误明显增多。此时优先选择什么？",
    player: [120, 246], opponent: [60, 16], answer: 1, lesson: "049", pages: "155",
    choices: [
      { text: "加到最大力量，追求压线", why: "本情境已给出力量加大时失误增多，压线会进一步缩小容错。", target: [40, 71] },
      { text: "中等速度发向反手大区", why: "利用已知稳定的发球建立主动，并为下一拍保留准备时间。", target: [82, 59] },
      { text: "只要进场就好，不设目标", why: "安全开始很重要，但可以同时使用自己能控制的大目标。", target: [65, 58] },
    ],
  },
  {
    id: "return", title: "接发：先化解强一发", situation: "强一发逼向你的反手，你准备时间短、身体略被挤住。对手发球后留在底线。优先怎么处理？",
    player: [137, 247], opponent: [70, 17], answer: 0, lesson: "075", pages: "244–245",
    choices: [
      { text: "缩短准备，挡回深中路", why: "在时间紧时简化动作，把球送回大区，争取恢复相持。", target: [95, 38] },
      { text: "大引拍抢攻边线", why: "大引拍增加准备时间；在被挤住时抢小目标风险更高。", target: [40, 23] },
      { text: "勉强放短后立即冲网", why: "本情境缺乏控制和时间，难以稳定完成短球并跟进。", target: [65, 112] },
    ],
  },
  {
    id: "neutral", title: "相持：这一球值得变线吗？", situation: "你在底线后接到一颗正常深度的斜线球，身体平衡，但没有明显短球机会。对手也已经站稳。",
    player: [140, 247], opponent: [50, 17], answer: 2, lesson: "062", pages: "244",
    choices: [
      { text: "每一球都抢直线制胜", why: "对手已站稳，来球也未创造明显机会；不必为变化而缩小容错。", target: [143, 29] },
      { text: "立即放短并冲到网前", why: "底线后处理正常深球，难以用放短稳定建立优势。", target: [59, 112] },
      { text: "继续深斜线，等待更好机会", why: "保持有余量的深斜线，观察是否获得短球或对手失位。", target: [53, 37] },
    ],
  },
  {
    id: "defend", title: "防守：先把时间找回来", situation: "你被拉出右侧边线，击球点偏低，身体还在跑动。对手留在后场，并未上网。",
    player: [166, 245], opponent: [95, 20], answer: 0, lesson: "047", pages: "244",
    choices: [
      { text: "提高弧线，回到深中路", why: "用较高弧线和大目标争取时间，随后恢复防守位置。", target: [95, 40] },
      { text: "低平直线全力抢攻", why: "低击球点和跑动失衡限制了控制，小窗口强攻容易提前结束这一分。", target: [148, 25] },
      { text: "追求短斜线小角度", why: "短斜线要求更精细的控制，也可能给已站稳的对手留下进攻机会。", target: [41, 100] },
    ],
  },
  {
    id: "net", title: "网前：低截击先延续", situation: "你随球上网，第一截击落在网带以下。对手在底线附近，仍能覆盖左右两边。",
    player: [100, 171], opponent: [90, 22], answer: 1, lesson: "053", pages: "244–245",
    choices: [
      { text: "向下猛压，追求直接得分", why: "触球点低于网带，向下猛压缺乏过网空间。", target: [143, 100] },
      { text: "控制拍面，先送进可控大区", why: "先让低截击过网并保持下一拍准备，再等待更高、更容易进攻的球。", target: [95, 52] },
      { text: "贴边放最短小球", why: "在低位第一截击尚不稳定时，贴边短球增加了控制难度。", target: [40, 118] },
    ],
  },
  {
    id: "opponent-net", title: "对手上网：看他留下哪里", situation: "对手已非常靠近网前，封住低平穿越的角度。你在底线站稳，来球速度适中，能够控制高吊。",
    player: [95, 241], opponent: [95, 108], answer: 2, lesson: "055", pages: "245",
    choices: [
      { text: "直接把平球送到对手拍前", why: "对手已在网前等球，平球送到拍前会让他更容易截击。", target: [95, 106] },
      { text: "不看站位，全力穿越最小角度", why: "已知低平角度被封住，应考虑对手身后空间。", target: [40, 94] },
      { text: "高吊越过对手，利用身后空间", why: "在平衡且能控制高吊的前提下，利用其过度靠网留下的后场空间。", target: [98, 32] },
    ],
  },
];
