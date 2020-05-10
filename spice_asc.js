const MAX_SUPPORTED_PARAMS = 6;
const R_t = 'R';
const L_t = 'L';
const C_t = 'C';
const V_t = 'V';
const I_t = 'I';
const VCVS_t = 'E';
const VCCS_t = 'G';
const CCVS_t = 'H';
const W_t = 'W';
const GND_t = 'GND';
const LABEL_t = 'LABEL';
const CCCS_t = '';

const SUPPORTED_TYPES = [R_t, L_t, C_t, I_t, V_t, VCVS_t, VCCS_t, CCVS_t, CCCS_t];
const CONVERSION_LUT = {
  'G': 1000000000,
  'M': 1000000,
  'k': 1000,
  'm': 0.001,
  'u': 0.000001,
  'μ': 0.000001,
  'n': 0.000000001,
  'p': 0.000000000001
};
const ASC_TO_TYPE_LUT = {
  'voltage': V_t,
  'g': VCCS_t,
  'e': VCVS_t,
  'current': I_t,
  'ind': L_t,
  'cap': C_t,
  'res': R_t,
  '0': GND_t,
  'VCC': LABEL_t,
  'VEE': LABEL_t,
  'OUT': LABEL_t
};
const srandPeriod = [
  0.5572978613694286,0.7582149729151599,0.2862383839181688,0.0851135310503035,0.3857092360396768,
  0.10854589277077564,0.10043959310730965,0.07897163507435967,0.059531712237846035,0.5680437870930326,
  0.5511564075206936,0.6517816271450048,0.5573825181515342,0.38603526445505953,0.8782514382266386,
  0.818673061241578,0.030401127239819692,0.21227061851393558,0.8128493286093568,0.7268907879281614,
  0.2162105812098638,0.22583230696461154,0.38650487378684817,0.5082198593610725,0.11763155737015585,
  0.4094371784114603,0.4113491635537132,0.3106631694040307,0.6723569902937514,0.057745431756258014,
  0.07094505845467403,0.5644540136837015,0.4565523797693942,0.23692901984034775,0.5610587334760848,
  0.4345369236290111,0.3029775563638897,0.9099885281828404,0.999487919596489,0.4674953918621325,
  0.16545667780021134,0.7453712177949463,0.9086073796290781,0.7481080966133704,0.08949986031435264,
  0.9394589329501264,0.09187695232564685,0.6224216761488557,0.04204362453361177,0.6149113988590482,
  0.6301153814982146,0.49455744461905704,0.6140411209302341,0.31288702094661214,0.21878973659650547,
  0.9800637905596798,0.9467418005956689,0.7522517821981889,0.2853035345372865,0.3232738778560602,
  0.6856084641545528,0.8082973405148486,0.056756596403062964,0.5640483445003084,0.8752227598598055,
  0.06391545814109878,0.19571017618315545,0.6163083865403982,0.9751206261347753,0.9055465992151772,
  0.7407589332674858,0.7018076923617376,0.4877208514449374,0.11756916640527693,0.97565223509792,
  0.03387387581326684,0.6942288104720435,0.1687830095281897,0.010625189544830604,0.038024167158434485,
  0.8152990536147857,0.9461401816293555,0.8512380311379575,0.04014183463230547,0.16379178837843522,
  0.8349076909657547,0.842158687091767,0.04284560092985079,0.6871073768878677,0.009582787858958275,
  0.49042842835495315,0.5091794790294164,0.38886363894896436,0.1121355544215159,0.01771899213379946,
  0.4278872496985018,0.19786300815018687,0.7647423743660644,0.7238064215318576,0.8168180818387911];
const DEFINED = (v) => v !== null && v !== undefined;
const nl_CLAMP = (v, min, max) => Math.min(Math.max(min, v), max);

function assert(bool) {
  if (!bool) {
    throw new Error('Assertion failed!');
  }
}

function assertComponents(components) {
  let i, j, c;
  for (i = 0; i < components.length; i++) {
    c = components[i];
    assert(SUPPORTED_TYPES.includes(c.type));

    // special check for dependent sources
    if ([VCVS_t, VCCS_t].includes(c.type)) {
      assert(DEFINED(c.ctrlPNode) && DEFINED(c.ctrlNNode));
    } else {
      delete c.ctrlPNode;
      delete c.ctrlNNode;
    }

    if ([CCVS_t, CCCS_t].includes(c.type)) {
      assert(DEFINED(c.vbranch));
    } else {
      delete c.vbranch;
    }

    // check for name uniqueness
    for (j = i+1; j < components.length; j++)
      assert(c.id !== components[j].id);
  }
}

function toNetlist(arr) {
  let components = [];

  let a, i, line, val, multiplier;
  for (i = 0; i < arr.length; i++) {
    if (!(line = arr[i]).length) {
      continue;
    }

    a = line.replace(/[!@#$%^&*\r]/g, '')
      .trim().split(' ');
    assert(a.length <= MAX_SUPPORTED_PARAMS);

    // value for 4-operand input
    val = a[3];

    // Check for voltage controlled dependent source
    let cpnode, cnnode;
    if ([VCVS_t, VCCS_t].includes(a[0][0])) {
      assert(a.length === 6);
      cpnode = a[3];
      cnnode = a[4];
      val = a[5];
    }

    // Check for current controlled dependent source
    let vbranch;
    if ([CCCS_t, CCVS_t].includes(a[0][0])) {
      assert(a.length === 5);
      vbranch = a[3];
      val = a[4];
    }

    multiplier = val.slice(-1);
    if (CONVERSION_LUT.hasOwnProperty(multiplier)) {
      multiplier = CONVERSION_LUT[multiplier];
      val = parseFloat(val.slice(0, -1));
    } else {
      multiplier = 1;
      val = parseFloat(val);
    }

    cpnode = parseInt(cpnode);
    cnnode = parseInt(cnnode);
    components.push({
      id: a[0],
      type: a[0][0],
      pnode: parseInt(a[1]),
      nnode: parseInt(a[2]),
      ctrlPNode: !isNaN(cpnode) ? cpnode : undefined, // voltage controlled
      ctrlNNode: !isNaN(cnnode) ? cnnode : undefined, // voltage controlled
      vbranch: DEFINED(vbranch) ? vbranch : undefined, // current controlled
      value: val * multiplier
    });
  }

  assertComponents(components);
  return components;
}

function fromAsc(lines, dim={x:1500,y:1000}) {
  let netlist, asc;
  let _asc_lines = [];
  {
    let _netlist_lines = [];
    let line;
    let i;
    for (i=0; i<lines.length; i++) {
      line = lines[i].split(' ');
      if (line[0] === ';') {
        _netlist_lines.push(line.slice(1).join(' '));
      } else {
        _asc_lines.push(lines[i]);
      }
    }

    netlist = toNetlist(_netlist_lines);
  }

  let xDim, yDim;
  {
    asc = [];
    let line, elem, isInsert;
    let i;
    for (i=0; i<_asc_lines.length; i++) {
      line = _asc_lines[i].split(' ');
      isInsert = false;
      elem = {
        id: '',
        type: '',
        R: 0,
        p_center: undefined,
        p_from: undefined,
        p_to: undefined
      };

      switch(line[0]) {
        case 'SHEET':
          xDim = parseInt(line[2]);
          yDim = parseInt(line[3]);
          break;
        case 'WIRE':
          isInsert = true;
          elem.id = `wire-${i}`;
          elem.type = W_t;
          elem.p_from = {
            x: parseInt(line[1]),
            y: parseInt(line[2])
          };
          elem.p_to = {
            x: parseInt(line[3]),
            y: parseInt(line[4])
          };
          break;
        case 'FLAG':
          elem.type = ASC_TO_TYPE_LUT[line[3]];

          switch(elem.type) {
            case GND_t:
              isInsert = true;
              elem.id = `gnd-${i}`;
              elem.type = GND_t;
              elem.p_center = {
                x: parseInt(line[1]),
                y: parseInt(line[2])
              };
              break;
            case LABEL_t:
            default:
          }
          break;
        case 'SYMBOL':
          isInsert = true;
          elem.type = ASC_TO_TYPE_LUT[line[1]];
          if (!elem.type) {
            throw new Error(`Unsupported type: ${line[1]}`);
          }
          elem.R = parseInt(line[4].slice(1));

          // adjust center position
          switch(elem.type) {
            case V_t:
            case VCCS_t:
            case VCVS_t:
            case I_t:
              if (elem.R === 0) {
                elem.p_center = {
                  x: parseInt(line[2]),
                  y: parseInt(line[3]) + 56
                };
              } else if (elem.R === 90) {
                elem.p_center = {
                  x: parseInt(line[2]) - 56,
                  y: parseInt(line[3])
                };
              } else if (elem.R === 180) {
                elem.p_center = {
                  x: parseInt(line[2]),
                  y: parseInt(line[3]) - 56
                };
              } else {
                elem.p_center = {
                  x: parseInt(line[2]) + 56,
                  y: parseInt(line[3])
                };
              }
              break;
            case R_t:
              if (elem.R === 0) {
                elem.p_center = {
                  x: parseInt(line[2]) + 16,
                  y: parseInt(line[3]) + 56
                };
              } else if (elem.R === 90) {
                elem.p_center = {
                  x: parseInt(line[2]) - 56,
                  y: parseInt(line[3]) + 16
                };
              } else if (elem.R === 180) {
                elem.p_center = {
                  x: parseInt(line[2]) - 16,
                  y: parseInt(line[3]) - 56
                };
              } else {
                elem.p_center = {
                  x: parseInt(line[2]) + 56,
                  y: parseInt(line[3]) - 16
                };
              }
              break;
            case C_t:
            case L_t:
              if (elem.R === 0) {
                elem.p_center = {
                  x: parseInt(line[2]) + 16,
                  y: parseInt(line[3]) + 26
                };
              } else if (elem.R === 90) {
                elem.p_center = {
                  x: parseInt(line[2]) - 26,
                  y: parseInt(line[3]) + 16
                };
              } else if (elem.R === 180) {
                elem.p_center = {
                  x: parseInt(line[2]) - 16,
                  y: parseInt(line[3]) - 26
                };
              } else {
                elem.p_center = {
                  x: parseInt(line[2]) - 26,
                  y: parseInt(line[3]) + 16
                };
              }
              break;
            default:
              elem.p_center = {
                x: parseInt(line[2]),
                y: parseInt(line[3])
              };
          }
          let _line;
          do {
            i++;
            if (i >= _asc_lines.length) {
              break;
            }
            _line = _asc_lines[i].split(' ');
            if (_line[1] === 'InstName') {
              elem.id = _line[2];
              break;
            }
          } while(true);
          break;
        default:
          break;
      }
      if (isInsert) {
        asc.push(elem);
      }
    }
  }

  {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let centerX = Math.floor(dim.x/2), centerY = Math.floor(dim.y/2);
    let vecAdj;
    let avgX = 0, avgY = 0;
    let numPoints = 0;
    let xScale = Math.min(1,dim.x/xDim);
    let yScale = Math.min(1, dim.y/yDim);
    const setMin = (vec) => {
      if (DEFINED(vec)) {
        minX = Math.min(vec.x, minX);
        minY = Math.min(vec.y, minY);
      }
    };
    const setMax = (vec) => {
      if (DEFINED(vec)) {
        maxX = Math.max(vec.x, maxX);
        maxY = Math.max(vec.y, maxY);
      }
    };
    const setAverage = (vec) => {
      if (DEFINED(vec)) {
        avgX += vec.x;
        avgY += vec.y;
        numPoints++;
      }
    };
    const adjustScale = (vec) => {
      let retVec;
      if (DEFINED(vec)) {
        retVec = {
          x: Math.floor(vec.x * xScale),
          y: Math.floor(vec.y * yScale)
        };
      } else {
        return vec;
      }
      return retVec;
    };
    const adjustPos = (vec, vecAdj) => {
      let retVec;
      if (DEFINED(vec)) {
        retVec = {
          x: vec.x + vecAdj.x,
          y: vec.y + vecAdj.y
        }
      } else {
        retVec = vec;
      }
      return retVec;
    };

    let elem;
    let i;
    for (i=0; i<asc.length; i++) {
      elem = asc[i];
      setMin(elem.p_center);
      setMin(elem.p_from);
      setMin(elem.p_to);
    }

    /*
     * adjust position so that minimum x / y value is
     * (0,0) (plus some offset)
     */
    vecAdj = {x: -minX + 50, y: -minY + 100};
    for (i=0; i<asc.length; i++) {
      elem = asc[i];
      elem.p_center = adjustPos(elem.p_center, vecAdj);
      elem.p_from = adjustPos(elem.p_from, vecAdj);
      elem.p_to = adjustPos(elem.p_to, vecAdj);
    }

    maxX = -Infinity;
    maxY = -Infinity;
    for (i=0; i<asc.length; i++) {
      elem = asc[i];
      setMax(elem.p_center);
      setMax(elem.p_from);
      setMax(elem.p_to);
    }

    /*
     * Scale down the components/wires so that it fits
     * within the specified width/height
     */
    xScale = Math.min(1,dim.x/maxX*0.9);
    yScale = Math.min(1, dim.y/maxY*0.9);
    for (i=0; i<asc.length; i++) {
      elem = asc[i];
      elem.p_center = adjustScale(elem.p_center);
      elem.p_from = adjustScale(elem.p_from);
      elem.p_to = adjustScale(elem.p_to);
    }

    // average of coordinates
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (i=0; i<asc.length; i++) {
      elem = asc[i];
      setMin(elem.p_center);
      setMin(elem.p_from);
      setMin(elem.p_to);
      setMax(elem.p_center);
      setMax(elem.p_from);
      setMax(elem.p_to);
    }

    /*
     * Center it
     */
    vecAdj = {
      x: centerX - ((maxX-minX)/2+minX),
      y: 0 /* Do not center vertically */
    };
    for (i=0; i<asc.length; i++) {
      elem = asc[i];
      elem.p_center = adjustPos(elem.p_center, vecAdj);
      elem.p_from = adjustPos(elem.p_from, vecAdj);
      elem.p_to = adjustPos(elem.p_to, vecAdj);
    }
  }

  // Add nodes: Isc, V for each node in the schematic
  let nodes = [];
  {
    let all_nodes = {};
    const upsertNode = (n_id, component) => {
      if (!all_nodes.hasOwnProperty(n_id)) {
        all_nodes[n_id] = {
          id: n_id,
          components: []
        };
      }
      all_nodes[n_id].components.push(component.id);
    };
    let srandInd = 0;
    const srandBool = () => {
      srandInd++;
      if (srandInd+1 === srandPeriod.length) {
        srandInd = 0;
      }
      return Math.floor(srandPeriod[srandInd]+0.5) === 1;
    };

    let component, n1, n2;
    let i;
    for (i=0; i<netlist.length; i++) {
      component = netlist[i];
      n1 = component.pnode;
      n2 = component.nnode;
      upsertNode(n1, component);
      upsertNode(n2, component);
    }

    /*
     * Placement of the SFG vertices (by circuit node):
     *  - Take y-coord of horizontal components R=90,270deg
     *  - Take x-coord of vertical components R=0,180deg
     *
     * If only horizontal/vertical components for a node,
     * average each component x-coord and y-coord.
     */
    let x_inc = 75, y_inc = 75;
    Object.values(all_nodes).forEach(node => {
      let xAvg = 0, yAvg = 0;
      let cwiseXAvg = -1, cwiseYAvg = -1;
      let hcount = 0, vcount = 0;
      let cList = node.components;
      let c;
      for (i=0; i<cList.length; i++) {
        c = asc.find(_asc => _asc.id === cList[i]);
        xAvg += c.p_center.x;
        yAvg += c.p_center.y;
        switch (c.R) {
          case 90:
          case 270:
            vcount++;
            cwiseYAvg = Math.max(0,cwiseYAvg);
            cwiseYAvg += c.p_center.y;
            break;
          case 0:
          case 180:
            hcount++;
            cwiseXAvg = Math.max(0,cwiseXAvg);
            cwiseXAvg += c.p_center.x;
            break;
          default:
        }
      }

      if (cwiseXAvg>=0 && cwiseYAvg>=0) {
        xAvg = Math.floor(cwiseXAvg/hcount);
        yAvg = Math.floor(cwiseYAvg/vcount);
      } else {
        xAvg = Math.floor(xAvg/cList.length);
        yAvg = Math.floor(yAvg/cList.length);
      }

      let p_V, p_Isc;
      p_V = {
        id: `V_n${node.id}`,
        x: xAvg,
        y: yAvg
      };
      p_Isc = {
        id: `ISC_n${node.id}`,
        x: nl_CLAMP(xAvg+x_inc, 0, dim.x-30),
        y: nl_CLAMP(yAvg+y_inc, 0, dim.y-30)
      };
      nodes.push(p_V);
      nodes.push(p_Isc);

      x_inc = srandBool() ? x_inc : -1*x_inc;
      y_inc = srandBool() ? y_inc : -1*y_inc;
    });
  }

  return {
    netlist,
    asc,
    nodes
  }
}

try {
  module.exports = {
    toNetlist,
    fromAsc,
    TYPES: {R_t, L_t, C_t, V_t, I_t, VCVS_t, VCCS_t}
  };
} catch(err) {
  /* Swallow error */
}
