// --------------------------------------------------------------------------------------------
// Circuit API for circuit analysis
const nl = require('./netlist.js');
const assert = require('assert');
const algebra = require('./rwalgebra/RWalgebra.js');
const math = require('mathjs');
const Expression = algebra.Expression;
const Equation = algebra.Equation;
var circuit;

/**
 * @param {node ID} id  
 * @param {voltage} v 
 * Class Attributes: 
 *  id: int
 *  voltage: Expression (initialized empty or with a #)
 *  passiveComponents: array of connected passive components (resistors, capacitors, inductors)
 *  incomingBranches: not used
 *  outgoingBranches: not used 
 */
function Node(id, v) {
    this.id = id,
    this.voltage = v,
    this.passiveComponents = [],
    this.currentSources = [],
    this.incomingBranches = [],
    this.outgoingBranches = []
};

Node.prototype.print = function(){
    console.log(`------------- Node ID: ${this.id} --------------`);
    console.log(`voltage: ${this.voltage}`);
    this.passiveComponents.forEach((pc, i) => {
        console.log(`Resistor #${i}`);
        pc.print();
    });
    this.currentSources.forEach((csrc, i) => {
        console.log(`Current Source #${i}`);
        csrc.print();
    });
    console.log(`-------------------------------------------`);
};

Node.prototype.allCurrentKnown = function(){
    // only current source(s) is/are connected to the node
    if (this.passiveComponents.length == 0 && this.currentSources.length != 0){
        return true;
    }
    else if (this.passiveComponents.length > this.currentSources.length){
        return false;
    }
    else if (this.passiveComponents.length == this.currentSources.length){
        var ret = true;

        this.passiveComponents.forEach((p) => {
            this.currentSources.forEach((c) => {
                 ret = PassiveComponentInSeriesWithCSrc(p, c);
            });

            if (!ret){
                return ret;
            }
            
        });
        return ret;
    }
};

/**
 * LEGACY CODE
 */
// Node.prototype.kcl = function(circuitObj){
//     var sum_lhs = new Expression(); // This is what this function will compute
//     var sum_rhs = new Expression(0); // sum of current is always 0
//     var sum_eq;
    
//     var equations = [];

//     for (var i = 0; i < this.passiveComponents.length; i++){
//         pComp = this.passiveComponents[i];
//         pComp.ohmsLaw(circuitObj);
//         //pComp.print(); //DEBUG

//         if (pComp.currentNumeric.real.constant != null){
//             equations.push(new Equation(pComp.currentNumeric, pComp.current));
//             sum_lhs.add(pComp.currentNumeric);
//         }
//         else{
//             equations.push(new Equation(`I${i}`, pComp.current));
//             if (this.id == pComp.pnode){
//                 sum_lhs.subtract(`I${i}`);
//             } 
//             else{
//                 sum_lhs.add(`I${i}`);
//             }
//         }
//     }

//     this.currentSources.forEach((c) => {
//         sum_lhs.add(c.value);
//     });

//     sum_eq = new Equation(sum_lhs, sum_rhs);
//     equations.push(sum_eq);
//     return equations;
// };

/* Calculate Driving Point Impedance 
   DPI = The impedance seen at a node when when we zero all the other node voltages and all
         current sources in the circuit */
Node.prototype.computeDpi = function(){
    var lhs = "DPI_n" + this.id.toString();
    var inverseSum = new Expression(0); // store (1/R1 + 1/R2 + ... + 1/Rn)
   this.passiveComponents.forEach ((r) => {
        inverseSum.add(r.value.inverse());
    });
    return new Equation(lhs, inverseSum.inverse());
};

/* Helper function for dpiAnalysis()
   short circuit current = The net current that flows into node n if node n is grounded and
   the currents due to all the other node voltages and current
   sources are added together */
Node.prototype.computeShortCircuitCurrent = function(){
    var iscTerms = []; // array of terms for ISC - one from passive elements and many from current sources
    var vol_tag = "V_n";
    var lhs = "ISC_n" + this.id.toString();
    var rhs = new Expression(0);

    this.passiveComponents.forEach ((r, i) => {
        var oppositeNodeId;
        var temp;

        // Get the node id of the other end of the passive component
        if (r.pnode == this.id){
            oppositeNodeId = r.nnode;
        }
        else{
            oppositeNodeId = r.pnode;
        }

        if (oppositeNodeId != 0){
            temp = vol_tag + oppositeNodeId.toString();
            temp = new Expression(temp).divide(r.value); // series of (V_n# / R)
            rhs.add(temp); // always positive because it's incoming (to the node) current
        }
    });

    iscTerms.push(new Equation(lhs, rhs));

    this.currentSources.forEach ((c) => {
        iscTerms.push(new Equation(lhs, c.value));
    });

    return iscTerms;
};

function Circuit(n, vsrc) {
    this.nodes = n // array of node objects
    this.unknownVnodes = [] // array of node ids that have unknown voltage values
    this.numVsrc = vsrc // number of voltage sources in circuit
};

Circuit.prototype.dpiAnalysis = function(){
    var eqns = [];
    var vol_tag = "V_n";
    var dpi_tag = "DPI_n";
    var isc_tag = "ISC_n";

    this.nodes.forEach (n => {
        // if n is in this.unknownVnodes:
        if (this.unknownVnodes.includes(n.id)){
            // first add V_n# = DPI_n# * ISC_n# to eqns
            var voltN = vol_tag + n.id.toString();
            var dpiN = dpi_tag + n.id.toString();
            var iscN = isc_tag + n.id.toString();
            var temp = dpiN + "*" + iscN;
            eqns.push(new Equation(voltN, temp));
            eqns.push(n.computeDpi());
            eqns = eqns.concat(n.computeShortCircuitCurrent());
        }

        else if (n.id != 0){ // do not include V_n0 = 0
            // Add V_n#(id) = c.voltage to eqns
            var voltN = vol_tag + n.id.toString();
            eqns.push(new Equation(voltN, n.voltage));
        }
    });

    return eqns;
};

Circuit.prototype.print = function(){
    this.nodes.forEach((n, i) => {
        n.print();
    });
};

/* Return True if a node with id 'nid' has not been added
   to the circuit object */
Circuit.prototype.nodeExists = function(nid){
    var exists = false;

    this.nodes.forEach((n) => {
        if (n.id == nid){
            exists = true;
            return;
        }
    });

    return exists;
};

Circuit.prototype.findNodeById = function(nid){
    return this.nodes.find(n => n.id === nid);
};

/**
 * NOW LEGACY CODE - replaced by dpiAnalysis()
 * Nodal analysis uses KCL, which gives a system of equations written in terms of node voltages
 */
Circuit.prototype.nodalAnalysis = function(){
    const numEqToSolve = this.nodes.length - this.numVsrc - 1;
    assert(this.unknownVnodes.length == numEqToSolve);

    var resultSummary = new AnalysisSummary();

    this.unknownVnodes.forEach((n_id) => {
        var equations_at_nodes = [];    // Store a list of equations at node x
        unknownVnode = this.findNodeById(n_id);
        
        if (unknownVnode.allCurrentKnown()){
            return;
        }
    
        // --- Start nodal analysis ---
        var equations = unknownVnode.kcl(this);

        if (equations != undefined){
            equations_at_nodes.push(equations);
        }
        // --- End nodal analysis ---
        
        //resultSummary.addSummary(n_id,
        //                         dpiAndShortCurrent[0],
        //                         dpiAndShortCurrent[1],
        //                         equations_at_nodes);
        
    });

    return resultSummary;
};

/*
* Class Attributes:
*  value: Expression (initialized with a #)
*  pnode: int
*  nnode: int
*  current: Expression
*  currentNumeric: Expression
*/
function PassiveComponent(v, p, n){
    this.value = v; // Impedance
    this.pnode = p;
    this.nnode = n;
    this.current = new Expression(); // start off undefined
    this.currentNumeric = new Expression(); // start off undefined
}

/**
 * LEGACY CODE
 * Find the expression of the current going through Resistor
 * Note it always subtract np from vp and does not handle the direction of current
 * @param {circuit object that Resistor belongs to} circuit 
 */
// PassiveComponent.prototype.ohmsLaw = function(circuitObj){
//     const pnode = circuitObj.findNodeById(this.pnode);
//     const nnode = circuitObj.findNodeById(this.nnode);
//     var vp, np;

//     if (pnode.voltage.real.constant == null){
//         var pterm = "n" + pnode.id.toString();
//         vp = new Expression(pterm);
//     }
//     else{
//         vp = pnode.voltage; // already in Expression form
//     }

//     if (nnode.voltage.real.constant == null){
//         var nterm = "n" + nnode.id.toString();
//         np = new Expression(nterm);
//     }
//     else{
//         np = nnode.voltage;
//     }

//     var numer = vp.subtract(np);
//     var denom = this.value; // already in Expression form
//     this.current = numer.divide(denom); 
// };

PassiveComponent.prototype.print = function(){
    console.log(`impedance: ${this.value}`);
    console.log(`positive node: ${this.pnode}`);
    console.log(`negative node: ${this.nnode}`);
    console.log(`current: ${this.current.toString()} Numeric current: ${this.currentNumeric.toString()}`);
};

/**
 * @param {value of resistance} r 
 * @param {positive node ID} p 
 * @param {negative node ID} n 
 * Extends PassiveComponent Class
 */
function Resistor(r, p, n){
    PassiveComponent.call(this, r, p, n);
};

Resistor.prototype = new PassiveComponent();
Resistor.prototype.constructor = Resistor;

/**
 * @param {value of capacitance} c 
 * @param {positive node ID} p 
 * @param {negative node ID} n 
 * Extends PassiveComponent Class
 */
function Capacitor(c, p, n){
    PassiveComponent.call(this, c, p, n);
}

Capacitor.prototype = new PassiveComponent();
Capacitor.prototype.constructor = Capacitor;

/**
 * @param {value of inductance} l 
 * @param {positive node ID} p 
 * @param {negative node ID} n 
 * Extends PassiveComponent Class
 */
function Inductor(l, p, n){
    PassiveComponent.call(this, l, p, n);
}

Inductor.prototype = new PassiveComponent();
Inductor.prototype.constructor = Inductor;

/**
 * 
 * @param {Current value} i 
 * @param {positive node ID} p 
 * @param {Negative node ID} n
 * Class Attributes:
 *  value: Expression (initialized with a constant only if dependent = false)
 *  pnode: int
 *  nnode: int
 *  dependent: boolean (true if dependent source, false if independent)
 */
function CurrentSource(i, p, n, dependency, cp=null, cn=null){
    this.value = i;
    this.pnode = p;
    this.nnode = n;
    this.dependent = dependency;
    this.controlPnode = cp;
    this.controlNnode = cn;
};

CurrentSource.prototype.print = function(){
    console.log(`current value: ${this.value}`);
    console.log(`positive node: ${this.pnode}`);
    console.log(`negative node: ${this.nnode}`);
};

/**
 * Determine whether r/c/l and csrc are in parallel and return a boolean value
 * If they are in parallel, update Resistor.currentNumeric
 * @param {PassiveComponent object under the subject} p 
 * @param {CurrentSource object under the subject} csrc 
 */
function PassiveComponentInSeriesWithCSrc(p, csrc){
    if (p.pnode == csrc.pnode){
        p.currentNumeric = csrc.value.multiply(-1);
        return true;
    }
    else if (p.pnode == csrc.nnode){
        p.currentNumeric = csrc.value;
        return true;
    }
    else if (p.nnode == csrc.pnode){
        p.currentNumeric = csrc.value;
        return true;
    }
    else if (p.nnode == csrc.nnode){
        p.currentNumeric = csrc.value.multiply(-1);
        return true;
    }
    else {
        false;
    }
}

/**
 * Create circuit object from intermediary input data structure
 * @param {intermediary data structure generated after parsing netlist file} components 
 * @returns circuit circuit object that represent the input circuit schematic
 */
function createCircuit(components){
    // Initialize an empty Circuit object
    var circuit = new Circuit([], 0);
    var nodeOfInterest;
    var VCVS_temp = []; // temprary storage for dependent voltage sources
    var VCCS_temp = []; // temporary storage for dependent current sources

    components.forEach((c) => {
        // adding nodes
        var nodeid = c.pnode;
        
        for (var i = 0; i < 2; i++){
            const nodeExists = circuit.nodeExists(nodeid);
            // Adding nodes to Circuit object
            if (!nodeExists){
                if (nodeid == 0){ // ground node
                    v = new Expression(0);
                }

                else{
                    circuit.unknownVnodes.push(nodeid);
                    v = new Expression(); //node voltage is unknown
                }
                
                node = new Node(nodeid, v);
                circuit.nodes.push(node);
            }

            nodeOfInterest = circuit.findNodeById(nodeid);
            // node of interest is pnode - nodes specified as nnode is outgoing branches
            if (i == 0){
                var outgoingB = nodeOfInterest.outgoingBranches;
                if (!outgoingB.includes(c.nnode)){
                    outgoingB.push(c.nnode);
                }
            }
            // node of interest is nnode - nodes specified as pnode is incoming branches 
            else{
                var incomingB = nodeOfInterest.incomingBranches;
                if (!incomingB.includes(c.pnode)){
                    incomingB.push(c.pnode);
                }
            }
            nodeid = c.nnode;
        }

        if (c.type == 'V' || c.type == "E"){
            var indexUnknownVnodes;

            circuit.numVsrc ++;

            if (c.type == 'V'){
                // Set the voltage value
                if (c.nnode == 0){
                    var pnode = circuit.findNodeById(c.pnode);
                    pnode.voltage = new Expression(c.value);
                }
                else if (c.pnode == 0){
                    var nnode = circuit.findNodeById(c.nnode);
                    nnode.voltage = new Expression(c.value * -1);
                }
            }
            else{
                // temporary store it to work on it after all the components are known
                VCVS_temp.push(c);
            }

            // Remove pnode and nnode of Voltage source from unknownVnodes array
            indexUnknownVnodes = circuit.unknownVnodes.indexOf(c.pnode);
            if (indexUnknownVnodes != -1){
                circuit.unknownVnodes.splice(indexUnknownVnodes, 1);
            }
            indexUnknownVnodes = circuit.unknownVnodes.indexOf(c.nnode);
            if (indexUnknownVnodes != -1){
                circuit.unknownVnodes.splice(indexUnknownVnodes, 1);
            }
        }
        else if(c.type == 'I'){
            cSrc  = new CurrentSource(new Expression(c.value), c.pnode, c.nnode, false);
            pnode = circuit.findNodeById(c.pnode);
            nnode = circuit.findNodeById(c.nnode);
            pnode.currentSources.push(cSrc);
            nnode.currentSources.push(cSrc);
        }
        else if (c.type == 'R'){
            r = new Resistor(new Expression(c.value), c.pnode, c.nnode);
            pnode = circuit.findNodeById(c.pnode);
            nnode = circuit.findNodeById(c.nnode);
            pnode.passiveComponents.push(r);
            nnode.passiveComponents.push(r);
        }

        else if (c.type == 'C'){
            var reactance = new Expression(`j * w * ${c.value}`);
            c = new Capacitor(new Expression(1).divide(reactance), c.pnode, c.nnode);
            pnode = circuit.findNodeById(c.pnode);
            nnode = circuit.findNodeById(c.nnode);
            pnode.passiveComponents.push(c);
            nnode.passiveComponents.push(c);
        }

        else if (c.type == 'L'){
            var impedance = new Expression('j * w');
            l = new Inductor(impedance.multiply(c.value), c.pnode, c.nnode);
            pnode = circuit.findNodeById(c.pnode);
            nnode = circuit.findNodeById(c.nnode);
            pnode.passiveComponents.push(l);
            nnode.passiveComponents.push(l);
        }

        else if (c.type == 'G'){ // V controlled current source
            VCCS_temp.push(c);
        }
    });

    VCVS_temp.forEach((vcvs) => {
        var ctrl_pnode = circuit.findNodeById(vcvs.ctrlPNode);
        var ctrl_nnode = circuit.findNodeById(vcvs.ctrlNNode);
        var pnode = circuit.findNodeById(vcvs.pnode);

        var ctrl_pnode_vol, ctrl_nnode_vol;

        if (ctrl_pnode.id != 0){ // in unknown array -> voltage not known
            ctrl_pnode_vol = new Expression(`V_n${ctrl_pnode.id}`);
        } 
        else{
            ctrl_pnode_vol = ctrl_pnode.voltage;
        }

        if (ctrl_nnode.id != 0){ // in unknown array -> voltage not known
            ctrl_nnode_vol = new Expression(`V_n${ctrl_nnode.id}`);
        } 
        else{
            ctrl_nnode_vol = ctrl_nnode.voltage;
        }

        // This is only true because we limit ourselves to a voltage source connected to the ground
        // voltage =  value * (ctrl_pnode - ctrl_nnode)
        //pnode.voltage = ctrl_pnode_vol.subtract(ctrl_nnode_vol).multiply(vcvs.value);
        pnode.voltage = algebra.parse(ctrl_pnode_vol.toString()).subtract(ctrl_nnode_vol).multiply(vcvs.value);
    });

    VCCS_temp.forEach((vccs) => {
        var ctrl_pnode = circuit.findNodeById(vccs.ctrlPNode);
        var ctrl_nnode = circuit.findNodeById(vccs.ctrlNNode);
        var current_val;
        var ctrl_pnode_vol, ctrl_nnode_vol;

        if (ctrl_pnode.id != 0){ // in unknown array -> voltage not known
            ctrl_pnode_vol = new Expression(`V_n${ctrl_pnode.id}`);
        } 
        else{
            ctrl_pnode_vol = ctrl_pnode.voltage;
        }

        if (ctrl_nnode.id != 0){ // in unknown array -> voltage not known
            ctrl_nnode_vol = new Expression(`V_n${ctrl_nnode.id}`);
        } 
        else{
            ctrl_nnode_vol = ctrl_nnode.voltage;
        }

        // This is only true because we limit ourselves to a voltage source connected to the ground
        // current =  value * (ctrl_pnode - ctrl_nnode)
        current_val = algebra.parse(ctrl_pnode_vol.toString()).subtract(ctrl_nnode_vol).multiply(vccs.value);
        cSrc  = new CurrentSource(current_val, vccs.pnode, vccs.nnode, true, vccs.ctrlPNode, vccs.ctrlNNode);
        pnode = circuit.findNodeById(vccs.pnode);
        nnode = circuit.findNodeById(vccs.nnode);
        pnode.currentSources.push(cSrc);
        nnode.currentSources.push(cSrc);
    });

    return circuit;
}

/**
 * LEGACY CODE
 * A stucture to store useful results from circuit analysis 
   This stucture can be used to compare analysis outputs for unit testing
   or passed into SFG functions 
   Use index to access the correct member variable in the arrays
   For example, if 4th element of nodeId array is 2, dpi[4] and currentEquations[4] will
   give you dpi and equations for node #2
 */
// function AnalysisSummary() {
//     this.nodeId = [], // IDs of nodes -- integers
//     this.dpi = [], // Driving point impedances (returned by dpiAnalysis()) -- Expressions
//     this.shorCircuitCurrent = [] // also returned by dpiAnalysis() -- Expressions
//     this.currentEquations = [] // lists of equations returned by kcl() -- Expressions
// };

// AnalysisSummary.prototype.addSummary= function(id, dpi, isc, eqs){
//     this.nodeId.push(id);
//     this.dpi.push(dpi);
//     this.shorCircuitCurrent.push(isc);
//     this.currentEquations.push(eqs);
// };

// (function main(){
//     const voltage_div = 'test/circuitModule/netlist_ann1.txt'
//     const var_simple = 'test/circuitModule/netlist_ann2.txt'
//     const curr_src = 'test/circuitModule/netlist_ann_csrc.txt'
//     const rc = 'test/circuitModule/netlist_ann_rc.txt'
//     const vcvs = 'test/circuitModule/netlist_ann_vcvs.txt'
//     const vcvs2 = 'test/circuitModule/netlist_ann_vcvs2.txt'
//     const amplifier = 'test/circuitModule/netlist_ann_vcvs3.txt'
//     const vccs = 'test/circuitModule/netlist_ann_vccs.txt'

//     c = nl.nlConsume(vcvs);
//     circuit = createCircuit(c);
//     var summary = circuit.dpiAnalysis();
// })();
// exports.setCircuit = (c) => {
//     circuit = c;
// };

exports.createCircuit = createCircuit;

