# circuitjs
## Circuit Analysis module
This module parses circuit information in SPICE NETLIST format and uses DPI (Driving Point Impedance) analysis to solve a series of circuit equations.
Please note that this module makes the following assumptions:
1. The only components in the given circuits are independent voltage/current sources, voltage controlled voltage/current sources, resistors, capacitors and inductors
2. There are no floating voltage sources (meaning, a voltage source must be grounded on one side)

The second assumption implies that a circuit that requires a super-node in its analysis is not supported. 

This module had been created as a part of a Capstone project, which can be found [here](https://github.com/capstone2019-2020/Capstone).

## File structure
There are 3 files here:
* Circuit.js: 
responsible for putting netlist information to circuit-related data structures and performing DPI analysis.
* Netlist.js: 
think of it as a wrapper function of spice_asc.js
* Spice_asc.js:
responsible for parsing the user’s input netlist/asc file so that it can be consumed by circuit.js

## Testing and Validation
Automated test(s) related to circuit analysis submodule:
- DPI analysis testing: done in https://github.com/capstone2019-2020/Capstone/tree/master/test/circuitModule
   - You will see a lot of .txt files and .acs files that we used for our test cases.
   - The actual testing code is in test.js
   - To run:  ```node test.js```
- Also note that in circuit.js, there is a function implemented for nodal analysis (it is commented out and marked as "LEGACY CODE", since nodal analysis was replaced by DPI analysis). We used this function for a while and it was tested in https://github.com/capstone2019-2020/Capstone/tree/master/test/m3
   - To run: ```npm run test_m3```
