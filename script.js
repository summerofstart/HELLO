// 定数定義
const QUBITS = 4;
const STEPS = 8;

// 状態管理
let circuit = Array(QUBITS).fill().map(() => Array(STEPS).fill(null));
let history = [JSON.stringify(circuit)];
let historyIndex = 0;
let controlQubit = null;

// 複素数クラス
class Complex {
    constructor(real, imag = 0) {
        this.real = real;
        this.imag = imag;
    }

    static add(a, b) {
        return new Complex(a.real + b.real, a.imag + b.imag);
    }

    static multiply(a, b) {
        return new Complex(
            a.real * b.real - a.imag * b.imag,
            a.real * b.imag + a.imag * b.real
        );
    }

    conjugate() {
        return new Complex(this.real, -this.imag);
    }

    magnitude() {
        return Math.sqrt(this.real * this.real + this.imag * this.imag);
    }

    toString() {
        return `${this.real.toFixed(2)}${this.imag >= 0 ? '+' : ''}${this.imag.toFixed(2)}i`;
    }
}

// 基本的な量子ゲート行列
const GATES = {
    H: [[new Complex(1/Math.sqrt(2)), new Complex(1/Math.sqrt(2))],
        [new Complex(1/Math.sqrt(2)), new Complex(-1/Math.sqrt(2))]],
    X: [[new Complex(0), new Complex(1)],
        [new Complex(1), new Complex(0)]],
    Y: [[new Complex(0), new Complex(0, -1)],
        [new Complex(0, 1), new Complex(0)]],
    Z: [[new Complex(1), new Complex(0)],
        [new Complex(0), new Complex(-1)]],
    S: [[new Complex(1), new Complex(0)],
        [new Complex(0), new Complex(0, 1)]],
    T: [[new Complex(1), new Complex(0)],
        [new Complex(0), new Complex(Math.cos(Math.PI/4), Math.sin(Math.PI/4))]]
};

// ゲートのQASM変換マッピング
const QASM_GATE_MAP = {
    H: 'h',
    X: 'x',
    Y: 'y',
    Z: 'z',
    S: 's',
    T: 't',
    Rx: 'rx(π/2)',
    Ry: 'ry(π/2)',
    Rz: 'rz(π/2)',
    CNOT: 'cx',
    CZ: 'cz',
    SWAP: 'swap'
};

// 初期化関数
function initializeCircuit() {
    const circuitDiv = document.getElementById('circuit');
    circuitDiv.innerHTML = '';

    // クビットラベルとゲートセルの追加
    for (let i = 0; i < QUBITS; i++) {
        const label = document.createElement('div');
        label.className = 'qubit-label';
        label.textContent = `q${i}`;
        circuitDiv.appendChild(label);

        for (let j = 0; j < STEPS; j++) {
            const cell = document.createElement('div');
            cell.className = 'gate-cell';
            cell.dataset.qubit = i;
            cell.dataset.step = j;
            setupDropZone(cell);
            circuitDiv.appendChild(cell);
        }
    }

    // ドラッグ可能なゲートボタンの設定
    document.querySelectorAll('.gate-button').forEach(button => {
        button.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', button.dataset.gate);
        });
    });
}

// ドロップゾーンの設定
function setupDropZone(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('droppable');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('droppable');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('droppable');
        const gate = e.dataTransfer.getData('text/plain');
        const qubit = parseInt(element.dataset.qubit);
        const step = parseInt(element.dataset.step);
        placeGate(qubit, step, gate);
    });
}

// ゲートの配置
function placeGate(qubit, step, gate) {
    const newCircuit = JSON.parse(JSON.stringify(circuit));
    
    if (['CNOT', 'CZ', 'SWAP'].includes(gate)) {
        if (controlQubit === null) {
            controlQubit = qubit;
            return;
        }
        if (controlQubit === qubit) {
            controlQubit = null;
            return;
        }
        newCircuit[controlQubit][step] = 'CONTROL';
        newCircuit[qubit][step] = gate;
        controlQubit = null;
    } else {
        newCircuit[qubit][step] = gate;
    }

    updateCircuit(newCircuit);
}

// 回路の更新
function updateCircuit(newCircuit) {
    circuit = newCircuit;
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.stringify(circuit));
    historyIndex++;
    renderCircuit();
}

// 回路の描画
function renderCircuit() {
    const cells = document.getElementsByClassName('gate-cell');
    for (let i = 0; i < QUBITS; i++) {
        for (let j = 0; j < STEPS; j++) {
            const cell = cells[i * STEPS + j];
            cell.innerHTML = '';
            
            if (circuit[i][j]) {
                const gate = document.createElement('div');
                gate.className = `gate ${circuit[i][j]}`;
                gate.textContent = circuit[i][j] === 'CONTROL' ? '•' : circuit[i][j];
                gate.draggable = true;
                gate.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', circuit[i][j]);
                });
                // 削除機能の追加
                gate.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const newCircuit = JSON.parse(JSON.stringify(circuit));
                    newCircuit[i][j] = null;
                    updateCircuit(newCircuit);
                });
                cell.appendChild(gate);
            }
        }
    }
}

// アンドゥ
function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        circuit = JSON.parse(history[historyIndex]);
        renderCircuit();
    }
}

// リドゥ
function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        circuit = JSON.parse(history[historyIndex]);
        renderCircuit();
    }
}

// 回路のクリア
function clearCircuit() {
    circuit = Array(QUBITS).fill().map(() => Array(STEPS).fill(null));
    controlQubit = null;
    updateCircuit(circuit);
}

// シミュレーション
function simulate() {
    let result = '初期状態: |0000⟩\n\n';
    let currentState = initialState();
    
    // 各ステップでの状態を追跡
    for (let step = 0; step < STEPS; step++) {
        let hasGates = false;
        for (let qubit = 0; qubit < QUBITS; qubit++) {
            if (circuit[qubit][step]) {
                hasGates = true;
                result += `Step ${step + 1}, Qubit ${qubit}: ${circuit[qubit][step]}\n`;
                
                if (GATES[circuit[qubit][step]]) {
                    currentState = applyGate(currentState, circuit[qubit][step], qubit);
                }
            }
        }
        if (hasGates) {
            result += `状態: ${stateToString(currentState)}\n\n`;
        }
    }

    result += '\n注意: これは簡易的なシミュレーションです。\n';
    result += '実際の量子状態の計算には完全な量子シミュレータが必要です。';
    
    document.getElementById('simulationResult').textContent = result;
}

// 初期状態の生成
function initialState() {
    const size = Math.pow(2, QUBITS);
    const state = new Array(size).fill(new Complex(0));
    state[0] = new Complex(1);
    return state;
}

// 状態を文字列に変換
function stateToString(state) {
    let result = '';
    for (let i = 0; i < state.length; i++) {
        if (state[i].magnitude() > 0.001) {
            if (result !== '') result += ' + ';
            result += `${state[i].toString()}|${i.toString(2).padStart(QUBITS, '0')}⟩`;
        }
    }
    return result || '0';
}

// ゲートの適用
function applyGate(state, gate, targetQubit) {
    const gateMatrix = GATES[gate];
    if (!gateMatrix) return state;

    const newState = new Array(state.length).fill(new Complex(0));
    const mask = 1 << (QUBITS - 1 - targetQubit);

    for (let i = 0; i < state.length; i++) {
        const bit = (i & mask) ? 1 : 0;
        const pair = i ^ mask;
        
        newState[i] = Complex.add(
            Complex.multiply(gateMatrix[0][0], state[i]),
            Complex.multiply(gateMatrix[0][1], state[pair])
        );
        newState[pair] = Complex.add(
            Complex.multiply(gateMatrix[1][0], state[i]),
            Complex.multiply(gateMatrix[1][1], state[pair])
        );
    }

    return newState;
}

// QASMエクスポート
function exportToQASM() {
    let qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\n\n';
    qasm += `qreg q[${QUBITS}];\n`;
    qasm += `creg c[${QUBITS}];\n\n`;

    // 各ステップのゲートを変換
    for (let step = 0; step < STEPS; step++) {
        for (let qubit = 0; qubit < QUBITS; qubit++) {
            const gate = circuit[qubit][step];
            if (!gate || gate === 'CONTROL') continue;

            if (['CNOT', 'CZ', 'SWAP'].includes(gate)) {
                // 制御ゲートの処理
                let controlQubit = -1;
                for (let q = 0; q < QUBITS; q++) {
                    if (circuit[q][step] === 'CONTROL') {
                        controlQubit = q;
                        break;
                    }
                }
                if (controlQubit !== -1) {
                    qasm += `${QASM_GATE_MAP[gate]} q[${controlQubit}],q[${qubit}];\n`;
                }
            } else {
                // 単一量子ビットゲートの処理
                qasm += `${QASM_GATE_MAP[gate]} q[${qubit}];\n`;
            }
        }
    }

    document.getElementById('qasmOutput').value = qasm;
}

// 初期化の実行
document.addEventListener('DOMContentLoaded', () => {
    initializeCircuit();
});
