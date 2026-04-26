export const scenarios = [
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
