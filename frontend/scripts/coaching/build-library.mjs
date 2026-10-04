import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const levels = [
  { id:1, name:'零基础 · 开始打球', short:'零基础', entry:'第一次接触网球，或尚不能稳定完成两拍。', ball:'红球／泡沫球；两侧发球区构成的短场，必要时继续缩短。', warm:'慢走与侧移后做抛接球、拍上平衡和两人轻抛；不做快速全场冲刺。', gate:'先看能否启动一分、合作三拍与基本报分，再考虑扩大场地。' },
  { id:2, name:'基础 · 稳定回合', short:'基础', entry:'可在短场完成三拍，能用简化发球启动；正在适应更长场地。', ball:'橙球或绿球；由个人稳定距离逐步扩大至全场，不按年龄强制换黄球。', warm:'动态侧移与前后调整后，小场正反手合作；从慢速逐渐加长距离。', gate:'看两侧入界率、二发和接发稳定性，不只看一次最长回合。' },
  { id:3, name:'发展 · 落点与选择', short:'发展', entry:'全场或适应场地能合作五拍，具备可用二发和基本接发。', ball:'绿球或黄球；单打全场为主，必要时减速而保留真实决策。', warm:'动态步法后做小场过渡到底线的合作球；逐步加入高低与深浅变化。', gate:'既记录击球成功，也记录攻、稳、守选择是否合理。' },
  { id:4, name:'俱乐部 · 组合与攻防', short:'俱乐部', entry:'能稳定完成六拍，能区分主动与被动球并打完整抢七。', ball:'黄球、标准全场；技术调整时可临时使用绿球。', warm:'动态活动后从中路对拉转到斜线，再加入本课方向变化；速度逐步提高。', gate:'检验前三拍、转换到网前与双打配合能否在真实回球下执行。' },
  { id:5, name:'进阶 · 模式与应变', short:'进阶', entry:'具备相对可靠的发接与底线模式，能主动进攻、回撤和网前续球。', ball:'黄球、标准全场；对抗速度按当日质量调整。', warm:'轻松对拉后做斜线、上网与发接各一小段；最后加入本课模式的低强度演练。', gate:'看模式遇到反制时能否调整；训练成功率是教学目标，不是官方等级。' },
  { id:6, name:'比赛 · 压力与计划', short:'比赛', entry:'可独立比赛和计分，已有主模式，希望把训练迁移到真实比赛。', ball:'黄球、标准全场；优先还原实际比赛中的发接、回球和比分。', warm:'模拟个人赛前热身：动态活动、底线、网前、低强度发接，逐步进入比赛节奏。', gate:'以比赛记录决定下一周期，不把120课视为保证升级的固定路径。' },
];
const diagrams = {
 mini:{name:'小场合作', note:'只使用网两侧的发球区；A、B互为搭档。另两名学员可在隔离的另一条短场通道练习，跨区立即停球。', players:[[95,165,'A'],[95,95,'B']], zones:[[37,68,116,56]], shots:[[95,165,95,96]], moves:[]},
 straight:{name:'中路／直线通道',note:'图示一条中路通道；直线课将通道平移到同侧，目标仍留边线余量。A击球、B喂球或对拉。',players:[[95,233,'A'],[95,27,'B']],zones:[[69,18,52,55]],shots:[[95,228,95,44]],moves:[]},
 cross:{name:'宽斜线通道',note:'A、B在相对斜角起始，目标是对面宽半场。另一斜线采用镜像布置；全场只开一组活球。',players:[[52,229,'A'],[138,30,'B']],zones:[[99,18,56,60]],shots:[[52,225,134,46],[138,37,56,215]],moves:[]},
 angles:{name:'方向选择',note:'A面对两个大目标；按来球与B的位置选择其中一个，实线为备选球路，不代表连续两拍。',players:[[90,220,'A'],[100,30,'B']],zones:[[37,21,46,75],[112,21,43,75]],shots:[[90,217,56,56],[90,217,134,56]],moves:[]},
 movement:{name:'移动与恢复',note:'A从中间准备，左右来球要求侧移后恢复；虚线只示意移动范围，真实回位应根据对手可打角度调整。',players:[[95,226,'A'],[95,30,'B']],zones:[[55,24,80,53]],shots:[[95,35,50,211],[95,35,140,211]],moves:[[95,226,53,221],[53,221,95,226]]},
 serve:{name:'发球大目标',note:'A从底线后向斜对角合法发球区发球，B接发。图示平分区；占先区左右镜像。初学者按教案前移发球。',players:[[120,243,'A'],[54,25,'B']],zones:[[35,76,60,54]],shots:[[120,238,63,99]],moves:[]},
 return:{name:'接发回大区',note:'A在下方发球，B在上方接发；细线为发球，返回的长线为接发目标。站位可按球速微调。',players:[[120,243,'A'],[53,25,'B']],zones:[[66,191,58,45]],shots:[[120,238,63,99],[53,32,92,216]],moves:[]},
 serveplus:{name:'发球 → 接发 → 第三拍',note:'1为发球、2为接发、3为发球者的下一拍。第三拍目标是示例；实际必须根据接回来的球重新选择。',players:[[119,243,'A'],[52,25,'B']],zones:[[111,21,44,53]],shots:[[119,238,55,99],[52,31,89,215],[89,215,133,47]],moves:[[119,239,91,229]]},
 defend:{name:'被动回球与恢复',note:'A从宽处防守回深大区，再恢复覆盖；高弧线以球路箭头示意，不表示飞行高度或真实轨迹。',players:[[36,222,'A'],[132,26,'B']],zones:[[61,20,78,55]],shots:[[36,218,99,46]],moves:[[36,224,84,228]]},
 approach:{name:'短球 → 上网 → 准备',note:'A从后场向前处理短球，深上网球后继续前移；在B触球附近准备。图示路线应按本课目标镜像或换向。',players:[[86,225,'A'],[132,25,'B']],zones:[[35,21,49,53]],shots:[[132,31,72,173],[72,173,56,44]],moves:[[86,224,72,176],[72,176,72,154]]},
 net:{name:'网前与底线对抗',note:'A是网前者，B是底线者；箭头给出一条来球与一条截击方向。具体高低与落点以本课练习说明为准。',players:[[93,156,'A'],[133,25,'B']],zones:[[38,26,63,58]],shots:[[133,32,93,157],[93,157,66,50]],moves:[]},
 lob:{name:'高吊与回撤',note:'B从后场高吊至A身后；箭头只表示水平落点。A转身移动，困难球允许落地后处理，避免盲目倒退。',players:[[95,157,'A'],[65,26,'B']],zones:[[56,191,85,45]],shots:[[65,32,102,213]],moves:[[95,158,111,200]]},
 doubles:{name:'双打分工',note:'默认一前一后起始，A与C一队，B与D一队。澳式、双底线等变式请按本课正文改变起始位置；图示不替代具体约定。',players:[[129,232,'A'],[60,25,'B'],[63,157,'C'],[127,103,'D']],zones:[[38,23,65,68]],shots:[[128,227,61,57]],moves:[[63,157,95,157],[129,232,92,232]]},
 doublesAussie:{name:'澳式起始与换位',note:'A发球、C网前，同在图示左侧起始，B接发、D为伙伴。A与C必须先约定空侧由谁覆盖；图示虚线是一种留网、发球者补右侧的选择。',players:[[82,243,'A'],[136,25,'B'],[62,157,'C'],[54,105,'D']],zones:[[95,74,57,54]],shots:[[82,238,128,101]],moves:[[82,238,126,223]]},
 doublesBack:{name:'双底线接发',note:'A发球、C网前；接发队B与D均退到底线附近。1为发球，2为B回深斜线；之后按来球共同调整，不能忘记前场短球。',players:[[120,243,'A'],[52,25,'B'],[62,157,'C'],[130,25,'D']],zones:[[99,192,54,43]],shots:[[120,238,62,99],[52,32,124,214]],moves:[]},
 doublesPress:{name:'双人前压',note:'A由后场击上网球后前移，C已在网前并随球调整。A/C一队，B/D防守；虚线为前移与横向补位，不要求两人紧贴同一横线。',players:[[127,218,'A'],[60,25,'B'],[62,155,'C'],[134,25,'D']],zones:[[38,23,59,59]],shots:[[127,214,60,53]],moves:[[127,216,124,160],[62,155,82,154]]},
 match:{name:'实战观察',note:'A、B按实际发接站位比赛，另两人从后围网外观察和记录。比分情境与目标见正文；双打比赛时改为四人同时上场。',players:[[119,242,'A'],[54,25,'B']],zones:[[40,22,112,60]],shots:[[119,237,64,98]],moves:[]},
};
let lessons=[];
for (const [i,file] of fs.readdirSync(path.join(root,'content/lessons')).filter(x=>x.endsWith('.txt')).sort().entries()) {
 const rows=fs.readFileSync(path.join(root,'content/lessons',file),'utf8').trim().split(/\r?\n/);
 if(rows.length!==20) throw Error(`${file}: expected 20 lessons`);
 for(const [j,row] of rows.entries()) {
  const fields=row.split('|'); if(fields.length!==10) throw Error(`${file}:${j+1} has ${fields.length} fields`);
  const [title,objective,drillA,drillB,game,cue,assessment,easier,harder,diagram]=fields;
  if(!diagrams[diagram]) throw Error(`Unknown diagram ${diagram}`);
  const id=String(i*20+j+1).padStart(3,'0');
  const specialized={'078':'doublesPress','095':'doublesAussie','096':'doublesBack'};
  lessons.push({id,level:i+1,sequence:j+1,title,objective,drillA,drillB,game,cue,assessment,easier,harder,diagram:specialized[id]||diagram});
 }
}
if(lessons.length!==120 || new Set(lessons.map(x=>x.title)).size!==120) throw Error('120 unique lessons required');
const data={version:1,updated:'2026-10-05',levels,diagrams,lessons};
fs.mkdirSync(path.join(root,'public/coaching'),{recursive:true});
fs.writeFileSync(path.join(root,'public/coaching/lessons.json'),JSON.stringify(data,null,2));
const template=fs.readFileSync(path.join(root,'scripts/coaching/library.template.html'),'utf8');
fs.writeFileSync(path.join(root,'public/coaching/index.html'),template.replace('/*__LESSON_DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log(`Built ${lessons.length} complete lessons / ${levels.length} levels / ${Object.keys(diagrams).length} court layouts.`);
