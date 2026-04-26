export const scenarios = [
  {
    id:'scenario_test_001', type:'single', tag:'Test Scenario', difficulty:'beginner', category:'attack line', hydrant:false,
    title:'Basic 200 Foot Preconnect', subtitle:'Beginner attack line problem',
    image:'images/scenarios/scenario_test_001.png',
    description:'Engine 1 is pumping a 200’ 1¾” preconnect flowing 150 GPM through a fog nozzle rated at 50 PSI. What pump pressure should the operator set?',
    line:{ hoseSize:'1.75', length:200, gpm:150, nozzlePressure:50 },
    applianceLoss:0, elevation:0, tolerance:5, correctPP:120,
    formulaBreakdown:[
      'PP = FL + NP',
      'FL = C × (GPM / 100)^2 × hose length in hundreds',
      'FL = 15.5 × (150 / 100)^2 × 2',
      'FL = 15.5 × 2.25 × 2',
      'FL = 69.75 PSI, rounded to 70 PSI',
      'PP = 70 + 50',
      'PP = 120 PSI'
    ]
  },
  {
    id:'wye_test_001_mobile', type:'wye', tag:'Wye Operation', difficulty:'intermediate', category:'wye', hydrant:false,
    title:'Engine 181 Wye Split Attack', subtitle:'Highest branch governs',
    image:'images/scenarios/wye_test_001_mobile.png',
    description:'Engine 181 is supplying a wye with 200’ of 2½” hose. Branch A is 150’ of 1¾” flowing 150 GPM with a fog nozzle at 50 PSI. Branch B is 200’ of 1¾” flowing 150 GPM with a fog nozzle at 50 PSI. What pump pressure should the operator set?',
    main:{ hoseSize:'2.5', length:200 },
    branches:[
      { label:'Branch A', hoseSize:'1.75', length:150, gpm:150, nozzlePressure:50 },
      { label:'Branch B', hoseSize:'1.75', length:200, gpm:150, nozzlePressure:50 }
    ],
    applianceLoss:0, elevation:0, tolerance:5, correctPP:155,
    formulaBreakdown:[
      'PP = FL + NP ± elevation + appliance loss',
      'Supply FL = 2 × (300 / 100)^2 × 2 = 36 PSI, rounded to 35 PSI',
      'Branch A FL = 15.5 × (150 / 100)^2 × 1.5 = 52.3 PSI, rounded to 52 PSI',
      'Branch A total = 35 + 52 + 50 = 137 PSI, rounded to 140 PSI',
      'Branch B FL = 15.5 × (150 / 100)^2 × 2 = 69.75 PSI, rounded to 70 PSI',
      'Branch B total = 35 + 70 + 50 = 155 PSI',
      'Wye appliance loss = 0 PSI because total flow is 300 GPM',
      'Highest pressure branch governs',
      'Correct PP = 155 PSI'
    ]
  },
  {
    id:'masterstream_181_001', type:'masterStream', tag:'Master Stream', difficulty:'advanced', category:'master stream', hydrant:false,
    title:'Engine 181 Portable Master Stream', subtitle:'Portable monitor supplied by two 2½” lines',
    image:'images/scenarios/masterstream_181_base.png',
    description:'Engine 181 is supplying a portable monitor with two 200’ 2½” lines. The monitor is flowing 500 GPM with a master stream nozzle pressure of 80 PSI. Use 15 PSI appliance loss for the portable monitor. What pump pressure should the operator set?',
    supplyLines:{ count:2, hoseSize:'2.5', length:200, totalGpm:500 },
    nozzlePressure:80,
    applianceLoss:15,
    elevation:0,
    tolerance:5,
    correctPP:120,
    formulaBreakdown:[
      'PP = FL + NP + appliance loss',
      'Total flow = 500 GPM',
      'Two equal 2½” lines means each line carries 250 GPM',
      '2½” hose C = 2',
      'FL = C × (GPM / 100)^2 × hose length in hundreds',
      'FL = 2 × (250 / 100)^2 × 2',
      'FL = 2 × 2.5^2 × 2',
      'FL = 2 × 6.25 × 2',
      'FL = 25 PSI',
      'Nozzle pressure = 80 PSI',
      'Portable monitor appliance loss = 15 PSI',
      'PP = 25 + 80 + 15',
      'PP = 120 PSI'
    ]
  },
  {
    id:'single_001', type:'single', tag:'Single Line', hydrant:true,
    title:'Single 1¾ Attack Line', subtitle:'Basic pump pressure problem',
    description:'Engine 1 is pumping a 200 foot 1¾ inch attack line with a 165 gpm fog nozzle at 50 psi.',
    line:{ hoseSize:'1.75', length:200, gpm:165, nozzlePressure:50 },
    applianceLoss:0, elevation:0, tolerance:5
  },
  {
    id:'wye_001', type:'wye', tag:'Wye Operation', hydrant:true,
    title:'2½ Supply to Gated Wye', subtitle:'Use the highest branch requirement',
    description:'A 200 foot 2½ inch line supplies a gated wye. Branch A is 200 feet of 1¾ inch hose with a 165 gpm fog nozzle at 50 psi. Branch B is 250 feet of 1¾ inch hose with a 150 gpm fog nozzle at 100 psi. Add 10 psi appliance loss for the wye.',
    main:{ hoseSize:'2.5', length:200 },
    branches:[
      { label:'Branch A', hoseSize:'1.75', length:200, gpm:165, nozzlePressure:50 },
      { label:'Branch B', hoseSize:'1.75', length:250, gpm:150, nozzlePressure:100 }
    ],
    applianceLoss:10, elevation:0, tolerance:5
  },
  {
    id:'standpipe_001', type:'standpipe', tag:'Standpipe', hydrant:true,
    title:'Standpipe Interior Line', subtitle:'FDC / standpipe allowance',
    description:'Engine 1 supplies the FDC. Interior crew has 150 feet of 2½ inch hose flowing 250 gpm through a smooth bore nozzle at 50 psi. Use 25 psi for standpipe/elevation allowance.',
    line:{ hoseSize:'2.5', length:150, gpm:250, nozzlePressure:50 },
    standpipePressure:25, elevation:0, tolerance:5
  }
];
