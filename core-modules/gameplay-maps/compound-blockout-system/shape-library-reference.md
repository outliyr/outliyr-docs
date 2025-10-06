# Shape Library Reference

The Compound Blockout tool comes with a library of procedural shapes designed for rapid level creation. They are categorized into **Primitives**, for basic massing, and **Architectural** shapes, which are specialized for creating common gameplay elements like stairs and ramps.

### Primitives

These are the fundamental building blocks for most of your work. They are simple, efficient, and versatile.

#### **Box** (`UBlockoutShape_Box`)

* **Use Case:** The workhorse for creating walls, floors, pillars, and any rectangular form.
* **Key Properties:**
  * `bUseHandles`: Toggles between interactive and numeric control.
  * **Handle Mode:** Drag the `SizeHandle` to define the opposite corner of the box from its pivot.
  * **Numeric Mode:** Directly set the `Dimensions` (Width, Depth, Height).

#### **Cylinder** (`UBlockoutShape_Cylinder`)

* **Use Case:** Perfect for pillars, pipes, towers, and circular platforms.
* **Key Properties:**
  * `Radius` & `Height`: Define the core dimensions.
  * `RadialSteps`: Controls the roundness of the cylinder. Lower values create polygonal shapes (e.g., a hexagon or octagon).
  * `bCapped`: If false, the cylinder will be an open tube. The tool automatically generates double-sided geometry for uncapped shapes so they look solid in-editor without needing a special material.

#### **Cone** (`UBlockoutShape_Cone`)

* **Use Case:** Creating rooftops, spires, or tapered columns. Can also be used to create funnels when used as a subtractive shape.
* **Key Properties:**
  * `BaseRadius` & `TopRadius`: Defines the radius at the bottom and top. Setting `TopRadius` to 0 creates a classic cone.
  * `Height`: The vertical size of the shape.
  * `bCapped`: Determines if the ends are sealed.

#### **Sphere** (`UBlockoutShape_Sphere`)

* **Use Case:** Blocking out domes, spherical landmarks, or for creating rounded indentations when used as a subtractive shape.
* **Key Properties:**
  * `Radius`: The size of the sphere.
  * `LongitudeSteps` & `LatitudeSteps`: Control the smoothness of the sphere.

#### **Torus** (`UBlockoutShape_Torus`)

* **Use Case:** Creating ring-shaped platforms, pipes, or arches.
* **Key Properties:**
  * `MajorRadius`: The radius of the overall ring, from the center to the tube's centerline.
  * `MinorRadius`: The radius of the tube itself.

***

### Architectural & Parametric Shapes

These are more advanced shapes designed to solve common level design challenges and maintain proper gameplay metrics.

#### **Ramp** (`UBlockoutShape_Ramp`)

* **Use Case:** Creating slopes and ramps with precise alignment. This shape is designed to remove the hassle of rotating and aligning simple boxes.
* **Key Properties:**
  * `FloorPoint` Handle: Defines the length and direction of the ramp's base on the ground plane.
  * `TopPoint` Handle: Defines the width and height at the top of the ramp. The tool automatically connects the points to form a solid, navigable ramp.

#### **Linear Stairs** (`UBlockoutShape_LinearStairs`)

* **Use Case:** Quickly creating a straight run of stairs that conforms to standard gameplay dimensions.
* **Key Properties:**
  * **Mode (`Adaptive` / `Fixed`):** This is the most important setting.
    * **Fixed:** You manually set the `NumSteps`. The tool divides the total height and depth by this number.
    * **Adaptive:** The tool automatically calculates the optimal number of steps to best match your `DesiredStepHeight`. This is the recommended mode for ensuring player navigation feels consistent.
  * `bFloating`: Toggles between solid-mass stairs (cheaper geometry) and floating treads (a more detailed look).

#### **Curved Stairs** (`UBlockoutShape_CurvedStairs`)

* **Use Case:** Creating spiral or curved staircases that wrap around a central point.
* **Key Properties:**
  * `InnerRadius` & `StepWidth`: Define the radial dimensions of the treads.
  * `TotalHeight` & `CurveAngle`: Control the overall rise and sweep of the staircase.
  * **Mode (`Adaptive` / `Fixed`):** Works just like Linear Stairs, but the "Adaptive" mode also considers the `DesiredGoing` (the arc length of a step) to ensure comfortable traversal.

#### **Prism** (`UBlockoutShape_Prism`)

* **Use Case:** Creating custom floor plans, non-rectangular walls, or complex polygonal holes. This is the go-to shape for anything that isn't a simple primitive.
* **Key Properties:**
  * `PolygonPoints`: An array of handles that define a 2D shape on a plane. You can add, remove, and drag these points to create any outline you need.
  * `Depth`: Extrudes the 2D polygon outline into a 3D solid.
  * `bAutoSort`: When enabled, the tool will automatically connect the polygon points in a sensible counter-clockwise order, preventing twisted or invalid geometry as you edit. It is highly recommended to keep this enabled.

#### **Room** (`UBlockoutShape_Room`)

* **Use Case:** The fastest way to block out an interior space. Instead of placing six separate boxes for a floor, ceiling, and four walls, the Room shape does it in one step.
* **Key Properties:**
  * `RoomDimensions`: Sets the _interior_ clear space of the room.
  * `WallThickness`: A single value that controls the thickness of all walls, the floor, and the ceiling.
  * **Face Toggles (`bShowFloor`, `bShowCeiling`, etc.):** These checkboxes let you easily remove faces. This is perfect for creating three-walled rooms, open ceilings for top-down views, or rooms without a floor that sit on a landscape.
