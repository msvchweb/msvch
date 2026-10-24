import type { ReactNode } from "react";
import styles from "./lesson-motion.module.css";

function Card({ x, y, table = false, children }: { x: number; y: number; table?: boolean; children?: ReactNode }) {
  return <g transform={`translate(${x} ${y})`}><g className={styles.float}>
    <rect className={styles.card} width="102" height="132" rx="13" />
    <path d="M22 28h36" className={styles.ink} />
    {table ? <g className={styles.rows}><path d="M20 48h62v61H20zM20 68h62M20 88h62M50 48v61" /></g> : <g className={styles.rows}><path d="M22 52h58M22 72h48M22 92h58M22 112h34" /></g>}
    {children}
  </g></g>;
}

function Core({ x = 300, y = 200 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r="58" className={styles.coreHalo} />
    <g className={styles.spin}><circle r="76" strokeDasharray="8 14" /><ellipse rx="95" ry="38" transform="rotate(35)" /><ellipse rx="95" ry="38" transform="rotate(-35)" /></g>
    <path className={styles.core} d="M0-38 33-19 33 19 0 38-33 19-33-19Z" />
    <path className={styles.ink} d="m0-18 5 13 13 5-13 5-5 13-5-13-13-5 13-5Z" />
  </g>;
}

function CheckMark({ x, y, radius = 24 }: { x: number; y: number; radius?: number }) {
  return <g transform={`translate(${x} ${y})`} className={styles.mint}><circle r={radius} className={styles.badge} /><path className={styles.check} d="m-11 0 8 8 15-17" /></g>;
}

function Scene({ index }: { index: number }) {
  switch (index) {
    case 0: return <><path className={styles.stream} d="M125 200h78m194 0h78" /><Card x={35} y={132} /><Core /><Card x={460} y={132} table /><circle className={styles.packet} cx="170" cy="200" r="5" /><circle className={styles.packetLate} cx="430" cy="200" r="5" /></>;
    case 1: return <><path className={styles.stream} d="M150 200h300" /><g transform="translate(70 70)"><g className={styles.float}><rect className={styles.card} width="210" height="245" rx="18" /><path className={styles.ink} d="M98 28h42" /><g className={styles.rows}><path d="M24 60h162v152H24ZM24 98h162M24 136h162M24 174h162M80 60v152M134 60v152" /></g></g></g><g transform="translate(335 105)"><g className={styles.floatLate}><rect className={styles.card} width="190" height="218" rx="18" /><path className={styles.ink} d="M28 38h65" /><g className={styles.rows}><path d="M28 76h134M28 103h115M28 130h134M28 157h88" /></g></g></g><CheckMark x={493} y={310} /></>;
    case 2: return <><rect className={styles.card} x="70" y="63" width="460" height="280" rx="22" /><path d="M70 106h460M107 85h1m14 0h1m14 0h1" /><g className={styles.float}><rect className={styles.bubble} x="105" y="133" width="160" height="46" rx="13" /><path className={styles.rows} d="M126 156h108" /></g><g className={styles.floatLate}><rect className={styles.bubble} x="242" y="202" width="250" height="46" rx="13" /><path className={styles.rows} d="M265 225h160" /></g><rect className={styles.input} x="100" y="280" width="399" height="38" rx="12" /><path className={styles.cursor} d="M128 291v16" /><g className={styles.mint}><circle className={styles.badge} cx="474" cy="299" r="13" /><path d="m468 300 6-6 6 6m-6-6v13" /></g></>;
    case 3: return <><g className={styles.stream}><path d="M140 100 300 200 460 100M140 300 300 200 460 300" /></g><Core /><Card x={70} y={28} /><Card x={430} y={28} /><Card x={70} y={258} table /><Card x={430} y={258} table /><g className={styles.pulse}><circle cx="222" cy="152" r="6" /><circle cx="378" cy="252" r="6" /></g></>;
    case 4: return <><path className={styles.stream} d="M208 126v132m184-132v132" /><g className={styles.upload}><Card x={157} y={40} /><Card x={341} y={68} table /></g><path className={styles.tray} d="m92 274 40-58h46m244 0h46l40 58v66H92Zm0 0h132l22 25h109l22-25h131" /><g className={styles.mint}><path className={styles.arrow} d="M300 205v62m-20-21 20 21 20-21" /></g></>;
    case 5: return <><g transform="translate(52 108)"><rect className={styles.card} width="245" height="186" rx="18" /><path className={styles.ink} d="M24 34h62" /><g className={styles.rows}><path d="M24 68h190M24 98h160M24 128h190M24 158h126" /></g><path className={styles.cursor} d="M158 147v18" /></g><path className={styles.stream} d="M318 200h105m-20-15 20 15-20 15" /><Card x={450} y={136} table /><circle className={styles.packet} cx="361" cy="200" r="6" /></>;
    case 6: return <><g transform="translate(300 200)"><circle r="124" className={styles.dial} /><circle r="104" strokeDasharray="2 18" /><g className={styles.clockHand}><path className={styles.ink} d="M0 0v-72" /><circle cy="-124" r="8" className={styles.core} /></g><path className={styles.ink} d="M0-12v12l42 25" /><circle r="9" className={styles.core} /></g><g className={styles.pulse}><circle className={styles.badge} cx="102" cy="200" r="23" /><path d="m92 200 8 8 14-17" /></g><g className={styles.pulseLate}><circle className={styles.badge} cx="498" cy="200" r="23" /><path d="m488 200 8 8 14-17" /></g></>;
    case 7: return <><Card x={90} y={115} /><Card x={408} y={115} table /><path className={styles.stream} d="M215 166h166M215 236h166" /><g transform="translate(300 200)"><circle r="48" className={styles.badge} /><path className={styles.ink} d="m-20-12 11-11-11-11m11 11h-34m63 58 11-11-11-11m11 11h-34" /><circle r="70" strokeDasharray="5 13" className={styles.spin} /></g><path className={styles.scan} d="M70 95v170m460-170v170" /></>;
    case 8: return <><g transform="translate(104 65)"><rect className={styles.card} width="270" height="270" rx="20" /><g className={styles.rows}><path d="M30 42h132M30 92h202M30 142h170M30 192h202M30 242h102" /></g><path className={styles.scan} d="M12 145h246" /></g><g className={styles.lens}><circle cx="389" cy="204" r="72" className={styles.badge} /><circle cx="389" cy="204" r="54" /><path className={styles.ink} d="m442 257 57 57M389 176v35m0 19v3" /></g><circle cx="135" cy="157" r="7" className={styles.pulse} /><circle cx="135" cy="257" r="7" className={styles.pulseLate} /></>;
    case 9: return <><Card x={78} y={130} /><path className={styles.stream} d="M200 200h175m-19-16 19 16-19 16" /><g transform="translate(394 77)"><g className={styles.floatLate}><rect className={styles.card} width="146" height="245" rx="18" /><g className={styles.rows}><path d="M22 37h96M22 77h74M22 117h96M22 157h82M22 197h96" /></g><rect className={styles.patch} x="12" y="60" width="122" height="34" rx="6" /><rect className={styles.patchLate} x="12" y="140" width="122" height="34" rx="6" /></g></g><CheckMark x={528} y={320} /></>;
    case 10: return <><g transform="translate(300 196)"><circle r="139" strokeDasharray="3 18" className={styles.spin} /><path className={styles.shield} d="m0-103 83 36v76c0 55-83 94-83 94s-83-39-83-94v-76Z" /><path className={styles.check} d="m-37 0 27 27 53-58" /></g><CheckMark x={113} y={128} radius={19} /><CheckMark x={488} y={267} radius={19} /></>;
    case 11: return <><g className={styles.fileToFolder}><Card x={244} y={42} /></g><g transform="translate(110 190)"><path className={styles.card} d="M0 125V0a15 15 0 0 1 15-15h123l25 30h194a15 15 0 0 1 15 15v95Z" /><path className={styles.folder} d="M0 125 27 34h370l-25 91Z" /><path className={styles.ink} d="M149 74h75" /></g><CheckMark x={476} y={302} /></>;
    default: return <><path className={styles.stream} d="m98 249 100-120 116 115 102-121 97 118" /><g className={styles.pulse}><CheckMark x={98} y={249} radius={26} /><CheckMark x={314} y={244} radius={26} /><CheckMark x={513} y={241} radius={26} /></g><g className={styles.pulseLate}><CheckMark x={198} y={129} radius={26} /><CheckMark x={416} y={123} radius={26} /></g><g transform="translate(305 95)" className={styles.spark}><path d="M0-24v48M-24 0h48m-40-16 32 32m-32 0 32-32" /></g><g transform="translate(422 303)" className={styles.sparkLate}><path d="M0-17v34M-17 0h34" /></g></>;
  }
}

export default function LessonMotion({ index }: { index: number }) {
  return <div className={styles.scene} data-lesson-scene={index + 1} aria-hidden="true">
    <div className={styles.wash} /><div className={styles.grid} /><div className={styles.ring} />
    <svg className={styles.drawing} viewBox="0 0 600 400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false"><Scene index={index} /></svg>
    <div className={styles.particles}>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${12 + i * 10}%`, top: `${16 + (i * 23) % 76}%`, animationDelay: `${i * -.9}s` }} />)}</div>
  </div>;
}
