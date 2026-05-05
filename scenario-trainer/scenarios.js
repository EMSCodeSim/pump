export const scenarios = [
  {
    "id": "single_line_preconnect_001",
    "title": "Basic 1¾ Preconnect to Front Door",
    "difficulty": "beginner",
    "category": "attack line",
    "type": "pump",
    "image": "single_line_preconnect_001.png",
    "question": "Engine 181 is stretching a 200' 1¾\" preconnect to the front door of a single-family dwelling. The fog nozzle is flowing 150 GPM at 50 PSI. No elevation and no appliance loss. What pump pressure should you set?",
    "correctPP": 120,
    "tolerance": 5,
    "answers": {
      "frictionLoss": 70,
      "nozzlePressure": 50,
      "elevation": 0,
      "applianceLoss": 0,
      "totalGpm": 150,
      "pumpPressure": 120,
      "tolerance": 5
    },
    "sceneElements": {
      "engine": "Engine 181",
      "hoses": [
        {
          "diameter": "1¾\"",
          "length": "200'",
          "flowGpm": 150,
          "cValue": 15.5,
          "status": "charged"
        }
      ],
      "nozzles": [
        {
          "type": "fog",
          "flowGpm": 150,
          "nozzlePressure": 50
        }
      ],
      "appliances": [],
      "elevation": "0 PSI"
    },
    "overlays": [
      {
        "label": "Engine",
        "text": "Engine 181",
        "x": 18,
        "y": 68
      },
      {
        "label": "Line",
        "text": "200' 1¾\"",
        "x": 45,
        "y": 52
      },
      {
        "label": "Nozzle",
        "text": "Fog 150 @ 50",
        "x": 70,
        "y": 33
      },
      {
        "label": "Elev",
        "text": "Level grade",
        "x": 49,
        "y": 72
      }
    ],
    "formulaBreakdown": [
      "PP = FL + NP + elevation + appliance loss",
      "FL per 100' = 15.5 × (150 ÷ 100)^2",
      "FL per 100' = 15.5 × 2.25 = 34.875 PSI",
      "Total FL = 34.875 × 2 = 69.75 ≈ 70 PSI",
      "PP = 70 + 50 + 0 + 0 = 120 PSI"
    ],
    "variations": [
      {
        "change": "Change hose length to 150' 1¾\". Same flow and nozzle.",
        "correctPP": 102
      },
      {
        "change": "Change flow to 185 GPM. Same 200' 1¾\" line and 50 PSI fog nozzle.",
        "correctPP": 156
      },
      {
        "change": "Change nozzle pressure to 75 PSI. Same 200' 1¾\" line at 150 GPM.",
        "correctPP": 145
      }
    ],
    "tags": [
      "single line",
      "preconnect",
      "1.75 inch",
      "fog nozzle",
      "beginner",
      "Engine 181"
    ]
  },
  {
    "id": "single_line_extended_002",
    "title": "Extended 1¾ Line to Second Floor",
    "difficulty": "intermediate",
    "category": "attack line",
    "type": "pump",
    "image": "single_line_extended_002.png",
    "question": "Engine 181 has a 250' 1¾\" line stretched to a second-floor apartment fire. The fog nozzle is flowing 185 GPM at 50 PSI. Add 5 PSI for the floor above the pump. No appliance loss. What pump pressure should you set?",
    "correctPP": 188,
    "tolerance": 5,
    "answers": {
      "frictionLoss": 133,
      "nozzlePressure": 50,
      "elevation": 5,
      "applianceLoss": 0,
      "totalGpm": 185,
      "pumpPressure": 188,
      "tolerance": 5
    },
    "sceneElements": {
      "engine": "Engine 181",
      "hoses": [
        {
          "diameter": "1¾\"",
          "length": "250'",
          "flowGpm": 185,
          "cValue": 15.5,
          "status": "charged"
        }
      ],
      "nozzles": [
        {
          "type": "fog",
          "flowGpm": 185,
          "nozzlePressure": 50
        }
      ],
      "appliances": [],
      "elevation": "+5 PSI, one floor above pump"
    },
    "overlays": [
      {
        "label": "Engine",
        "text": "Engine 181",
        "x": 18,
        "y": 69
      },
      {
        "label": "Line",
        "text": "250' 1¾\"",
        "x": 43,
        "y": 55
      },
      {
        "label": "Nozzle",
        "text": "Fog 185 @ 50",
        "x": 72,
        "y": 29
      },
      {
        "label": "Elev",
        "text": "+5 PSI",
        "x": 64,
        "y": 39
      }
    ],
    "formulaBreakdown": [
      "PP = FL + NP + elevation + appliance loss",
      "FL per 100' = 15.5 × (185 ÷ 100)^2",
      "FL per 100' = 15.5 × 3.4225 = 53.04875 PSI",
      "Total FL = 53.04875 × 2.5 = 132.621875 ≈ 133 PSI",
      "PP = 133 + 50 + 5 + 0 = 188 PSI"
    ],
    "variations": [
      {
        "change": "Change hose length to 200' 1¾\". Same 185 GPM nozzle and +5 PSI elevation.",
        "correctPP": 161
      },
      {
        "change": "Change flow to 150 GPM. Same 250' 1¾\" line and +5 PSI elevation.",
        "correctPP": 142
      },
      {
        "change": "Change elevation to three floors above the pump, +15 PSI. Same line and flow.",
        "correctPP": 198
      }
    ],
    "tags": [
      "single line",
      "extended preconnect",
      "1.75 inch",
      "fog nozzle",
      "elevation",
      "Engine 181"
    ]
  },
  {
    "id": "single_line_heavy_003",
    "title": "Heavy 2½ Smooth Bore Attack Line",
    "difficulty": "intermediate",
    "category": "attack line",
    "type": "pump",
    "image": "single_line_heavy_003.png",
    "question": "Engine 181 is supplying a 250' 2½\" attack line to the corner of a commercial strip. The nozzle is a 1⅛\" smooth bore flowing about 265 GPM at 50 PSI. No elevation and no appliance loss. What pump pressure should you set?",
    "correctPP": 85,
    "tolerance": 5,
    "answers": {
      "frictionLoss": 35,
      "nozzlePressure": 50,
      "elevation": 0,
      "applianceLoss": 0,
      "totalGpm": 265,
      "pumpPressure": 85,
      "tolerance": 5
    },
    "sceneElements": {
      "engine": "Engine 181",
      "hoses": [
        {
          "diameter": "2½\"",
          "length": "250'",
          "flowGpm": 265,
          "cValue": 2,
          "status": "charged"
        }
      ],
      "nozzles": [
        {
          "type": "smooth bore",
          "tip": "1⅛\"",
          "flowGpm": 265,
          "nozzlePressure": 50
        }
      ],
      "appliances": [],
      "elevation": "0 PSI"
    },
    "overlays": [
      {
        "label": "Engine",
        "text": "Engine 181",
        "x": 16,
        "y": 68
      },
      {
        "label": "Line",
        "text": "250' 2½\"",
        "x": 43,
        "y": 55
      },
      {
        "label": "Nozzle",
        "text": "SB 1⅛ @ 50",
        "x": 73,
        "y": 32
      },
      {
        "label": "Target",
        "text": "Commercial",
        "x": 67,
        "y": 20
      }
    ],
    "formulaBreakdown": [
      "PP = FL + NP + elevation + appliance loss",
      "FL per 100' = 2 × (265 ÷ 100)^2",
      "FL per 100' = 2 × 7.0225 = 14.045 PSI",
      "Total FL = 14.045 × 2.5 = 35.1125 ≈ 35 PSI",
      "PP = 35 + 50 + 0 + 0 = 85 PSI"
    ],
    "variations": [
      {
        "change": "Change hose length to 200' 2½\". Same 1⅛\" smooth bore at 265 GPM.",
        "correctPP": 78
      },
      {
        "change": "Change nozzle to 1\" smooth bore flowing about 210 GPM. Same 250' 2½\" line.",
        "correctPP": 72
      },
      {
        "change": "Add one floor of elevation, +5 PSI. Same line, flow, and nozzle.",
        "correctPP": 90
      }
    ],
    "tags": [
      "single line",
      "2.5 inch",
      "smooth bore",
      "commercial",
      "heavy attack",
      "Engine 181"
    ]
  },
  {
    "id": "standpipe-engine181-multi",
    "title": "Standpipe Operation with Reusable Overlay Labels",
    "type": "standpipe",
    "chip": "STANDPIPE",
    "image": "standpipe-engine181.png",
    "scene": "Engine 181 is supplying the FDC for a standpipe operation in a multi-story apartment building. The picture has no built-in labels. All labels are generated from this JSON using overlay coordinates.",
    "studentQuestion": "Calculate the pump pressure for the standpipe attack line setup.",
    "details": [
      "Engine 181 supplying the FDC",
      "Standpipe system loss: 25 psi",
      "Attack line from standpipe outlet to fire apartment",
      "2½″ attack line, C value 2",
      "Smooth bore nozzle pressure: 50 psi",
      "Elevation: +5 psi per floor",
      "Use ±5 psi tolerance"
    ],
    "overlays": [
      {
        "label": "Engine",
        "text": "Engine 181",
        "x": 18,
        "y": 63
      },
      {
        "label": "FDC",
        "text": "FDC",
        "x": 44,
        "y": 56
      },
      {
        "label": "Standpipe",
        "text": "Standpipe",
        "x": 55,
        "y": 25
      },
      {
        "label": "Attack Line",
        "text": "150′ 2½″",
        "x": 39,
        "y": 39
      },
      {
        "label": "Nozzle",
        "text": "SB 1⅛″ @ 50",
        "x": 72,
        "y": 20
      },
      {
        "label": "Fire Floor",
        "text": "Floor 3",
        "x": 73,
        "y": 32
      },
      {
        "label": "Elevation",
        "text": "+15 psi",
        "x": 74,
        "y": 37
      },
      {
        "label": "System Loss",
        "text": "System +25",
        "x": 57,
        "y": 49
      }
    ],
    "answers": {
      "frictionLoss": 21,
      "nozzlePressure": 50,
      "elevationPressure": 15,
      "elevation": 15,
      "applianceLoss": 25,
      "totalGpm": 265,
      "pumpPressure": 111
    },
    "formulaBreakdown": [
      "Flow for 1⅛″ smooth bore = 265 gpm",
      "FL per 100′ = C × (GPM ÷ 100)^2",
      "FL per 100′ = 2 × (265 ÷ 100)^2 = 14 psi",
      "Total FL = 14 × 1.5 = 21 psi",
      "Elevation = Floor 3 × 5 psi = 15 psi",
      "PP = 21 FL + 50 NP + 15 elevation + 25 system loss = 111 psi"
    ],
    "correctPP": 111,
    "tolerance": 5,
    "instructorExplanation": "For this standpipe operation, calculate the friction loss in the 2½″ attack line from the standpipe outlet to the nozzle, then add smooth bore nozzle pressure, elevation pressure, and the 25 psi standpipe system loss. PP = FL + NP + elevation + system loss.",
    "explainMistake": "Common mistakes are forgetting the 25 psi standpipe system loss, using the wrong C value for 2½″ hose, using the wrong smooth bore flow, counting nozzle pressure twice, or missing the elevation pressure for the fire floor.",
    "variations": [
      {
        "change": "Base question: 150′ of 2½″ attack line, 1⅛″ smooth bore nozzle, Floor 3.",
        "question": "Engine 181 is supplying the FDC. The crew is operating from Floor 3 with 150′ of 2½″ hose and a 1⅛″ smooth bore nozzle. What pump pressure should you set?",
        "correctPP": 111,
        "tolerance": 5,
        "details": [
          "Engine 181 supplying the FDC",
          "150′ of 2½″ attack line from the standpipe outlet",
          "1⅛″ smooth bore nozzle flowing 265 gpm",
          "Smooth bore nozzle pressure: 50 psi",
          "Floor 3 elevation: +15 psi",
          "Standpipe system loss: 25 psi"
        ],
        "answers": {
          "frictionLoss": 21,
          "nozzlePressure": 50,
          "elevationPressure": 15,
          "elevation": 15,
          "applianceLoss": 25,
          "totalGpm": 265,
          "pumpPressure": 111
        },
        "overlays": [
          {
            "label": "Engine",
            "text": "Engine 181",
            "x": 18,
            "y": 63
          },
          {
            "label": "FDC",
            "text": "FDC",
            "x": 44,
            "y": 56
          },
          {
            "label": "Standpipe",
            "text": "Standpipe",
            "x": 55,
            "y": 25
          },
          {
            "label": "Attack Line",
            "text": "150′ 2½″",
            "x": 39,
            "y": 39
          },
          {
            "label": "Nozzle",
            "text": "SB 1⅛″ @ 50",
            "x": 72,
            "y": 20
          },
          {
            "label": "Fire Floor",
            "text": "Floor 3",
            "x": 73,
            "y": 32
          },
          {
            "label": "Elevation",
            "text": "+15 psi",
            "x": 74,
            "y": 37
          },
          {
            "label": "System Loss",
            "text": "System +25",
            "x": 57,
            "y": 49
          }
        ],
        "formulaBreakdown": [
          "FL = 2 × (265 ÷ 100)^2 × 1.5",
          "FL = 21 psi",
          "PP = 21 FL + 50 NP + 15 elevation + 25 system loss",
          "PP = 111 psi"
        ],
        "instructorExplanation": "Use the 2½″ attack line friction loss from the standpipe outlet, then add 50 psi nozzle pressure, Floor 3 elevation, and 25 psi standpipe system loss."
      },
      {
        "change": "Increase the attack line length to 200′ of 2½″ hose. Keep the 1⅛″ smooth bore nozzle and Floor 3.",
        "question": "Same picture, new setup: Engine 181 is supplying the FDC. The crew is operating from Floor 3 with 200′ of 2½″ hose and a 1⅛″ smooth bore nozzle. What pump pressure should you set?",
        "correctPP": 118,
        "tolerance": 5,
        "details": [
          "Engine 181 supplying the FDC",
          "200′ of 2½″ attack line from the standpipe outlet",
          "1⅛″ smooth bore nozzle flowing 265 gpm",
          "Smooth bore nozzle pressure: 50 psi",
          "Floor 3 elevation: +15 psi",
          "Standpipe system loss: 25 psi"
        ],
        "answers": {
          "frictionLoss": 28,
          "nozzlePressure": 50,
          "elevationPressure": 15,
          "elevation": 15,
          "applianceLoss": 25,
          "totalGpm": 265,
          "pumpPressure": 118
        },
        "overlays": [
          {
            "label": "Engine",
            "text": "Engine 181",
            "x": 18,
            "y": 63
          },
          {
            "label": "FDC",
            "text": "FDC",
            "x": 44,
            "y": 56
          },
          {
            "label": "Standpipe",
            "text": "Standpipe",
            "x": 55,
            "y": 25
          },
          {
            "label": "Attack Line",
            "text": "200′ 2½″",
            "x": 39,
            "y": 39
          },
          {
            "label": "Nozzle",
            "text": "SB 1⅛″ @ 50",
            "x": 72,
            "y": 20
          },
          {
            "label": "Fire Floor",
            "text": "Floor 3",
            "x": 73,
            "y": 32
          },
          {
            "label": "Elevation",
            "text": "+15 psi",
            "x": 74,
            "y": 37
          },
          {
            "label": "System Loss",
            "text": "System +25",
            "x": 57,
            "y": 49
          }
        ],
        "formulaBreakdown": [
          "FL = 2 × (265 ÷ 100)^2 × 2",
          "FL = 28 psi",
          "PP = 28 FL + 50 NP + 15 elevation + 25 system loss",
          "PP = 118 psi"
        ],
        "instructorExplanation": "Only the hose length changed. The longer 2½″ attack line increases friction loss from 21 psi to 28 psi."
      },
      {
        "change": "Move the operation to Floor 5. Keep 150′ of 2½″ hose and the 1⅛″ smooth bore nozzle.",
        "question": "Same picture, new setup: Engine 181 is supplying the FDC. The crew is operating from Floor 5 with 150′ of 2½″ hose and a 1⅛″ smooth bore nozzle. What pump pressure should you set?",
        "correctPP": 121,
        "tolerance": 5,
        "details": [
          "Engine 181 supplying the FDC",
          "150′ of 2½″ attack line from the standpipe outlet",
          "1⅛″ smooth bore nozzle flowing 265 gpm",
          "Smooth bore nozzle pressure: 50 psi",
          "Floor 5 elevation: +25 psi",
          "Standpipe system loss: 25 psi"
        ],
        "answers": {
          "frictionLoss": 21,
          "nozzlePressure": 50,
          "elevationPressure": 25,
          "elevation": 25,
          "applianceLoss": 25,
          "totalGpm": 265,
          "pumpPressure": 121
        },
        "overlays": [
          {
            "label": "Engine",
            "text": "Engine 181",
            "x": 18,
            "y": 63
          },
          {
            "label": "FDC",
            "text": "FDC",
            "x": 44,
            "y": 56
          },
          {
            "label": "Standpipe",
            "text": "Standpipe",
            "x": 55,
            "y": 25
          },
          {
            "label": "Attack Line",
            "text": "150′ 2½″",
            "x": 39,
            "y": 39
          },
          {
            "label": "Nozzle",
            "text": "SB 1⅛″ @ 50",
            "x": 72,
            "y": 20
          },
          {
            "label": "Fire Floor",
            "text": "Floor 5",
            "x": 73,
            "y": 32
          },
          {
            "label": "Elevation",
            "text": "+25 psi",
            "x": 74,
            "y": 37
          },
          {
            "label": "System Loss",
            "text": "System +25",
            "x": 57,
            "y": 49
          }
        ],
        "formulaBreakdown": [
          "FL = 2 × (265 ÷ 100)^2 × 1.5",
          "FL = 21 psi",
          "Elevation = 5 floors × 5 psi = 25 psi",
          "PP = 21 FL + 50 NP + 25 elevation + 25 system loss",
          "PP = 121 psi"
        ],
        "instructorExplanation": "Only the elevation changed. The fire floor moves from Floor 3 to Floor 5, so elevation pressure changes from 15 psi to 25 psi."
      },
      {
        "change": "Change the nozzle to a 15/16″ smooth bore. Keep 150′ of 2½″ hose and Floor 3.",
        "question": "Same picture, new setup: Engine 181 is supplying the FDC. The crew is operating from Floor 3 with 150′ of 2½″ hose and a 15/16″ smooth bore nozzle. What pump pressure should you set?",
        "correctPP": 100,
        "tolerance": 5,
        "details": [
          "Engine 181 supplying the FDC",
          "150′ of 2½″ attack line from the standpipe outlet",
          "15/16″ smooth bore nozzle flowing 185 gpm",
          "Smooth bore nozzle pressure: 50 psi",
          "Floor 3 elevation: +15 psi",
          "Standpipe system loss: 25 psi"
        ],
        "answers": {
          "frictionLoss": 10,
          "nozzlePressure": 50,
          "elevationPressure": 15,
          "elevation": 15,
          "applianceLoss": 25,
          "totalGpm": 185,
          "pumpPressure": 100
        },
        "overlays": [
          {
            "label": "Engine",
            "text": "Engine 181",
            "x": 18,
            "y": 63
          },
          {
            "label": "FDC",
            "text": "FDC",
            "x": 44,
            "y": 56
          },
          {
            "label": "Standpipe",
            "text": "Standpipe",
            "x": 55,
            "y": 25
          },
          {
            "label": "Attack Line",
            "text": "150′ 2½″",
            "x": 39,
            "y": 39
          },
          {
            "label": "Nozzle",
            "text": "SB 15/16″ @ 50",
            "x": 72,
            "y": 20
          },
          {
            "label": "Fire Floor",
            "text": "Floor 3",
            "x": 73,
            "y": 32
          },
          {
            "label": "Elevation",
            "text": "+15 psi",
            "x": 74,
            "y": 37
          },
          {
            "label": "System Loss",
            "text": "System +25",
            "x": 57,
            "y": 49
          }
        ],
        "formulaBreakdown": [
          "Flow for 15/16″ smooth bore = 185 gpm",
          "FL = 2 × (185 ÷ 100)^2 × 1.5",
          "FL = 10 psi",
          "PP = 10 FL + 50 NP + 15 elevation + 25 system loss",
          "PP = 100 psi"
        ],
        "instructorExplanation": "Only the nozzle changed. The smaller smooth bore lowers the flow, which lowers friction loss in the 2½″ attack line."
      }
    ]
  }
];
