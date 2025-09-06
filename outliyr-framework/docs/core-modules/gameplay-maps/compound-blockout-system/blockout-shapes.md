# Blockout Shapes

The `Compound Blockout System` provides a set of highly customizable geometric primitives, or `Blockout Shapes`, that form the building blocks of your level layouts. Each shape offers unique parameters to control its form and how it interacts with other shapes through boolean operations.

You can add these shapes to your `Compound Blockout Actor`'s "Shapes" array in the Details panel. Remember that their `Operation` (Add/Subtract) and their order in the list dictate the final combined mesh.

### Box (`UBlockoutShape_Box`)

The fundamental cuboid shape, essential for defining rooms, walls, platforms, and general solid volumes.

* **Parameters:**
  * **Dimensions (FVector):** Defines the `X`, `Y`, and `Z` size of the box in Unreal Units (cm).
    * _Default:_ (100, 100, 100)

### Sphere (`UBlockoutShape_Sphere`)

A basic spherical primitive, useful for curved surfaces, domed ceilings, or specific architectural features.

* **Parameters:**
  * **Radius (float):** The radius of the sphere.
    * _Default:_ 50.0
  * **Steps Phi (int32):** Controls the vertical resolution (number of horizontal slices, like latitude lines). Higher values result in a smoother sphere.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 32
  * **Steps Theta (int32):** Controls the horizontal resolution (number of vertical segments, like longitude lines). Higher values result in a smoother sphere.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 32

### Cylinder (`UBlockoutShape_Cylinder`)

A common cylindrical primitive, useful for columns, pipes, or curved wall sections. When `bCapped` is false, it automatically generates an inward-facing surface to create a hollow tube with correctly oriented normals.

* **Parameters:**
  * **Radius (float):** The radius of the cylinder's base and top.
    * _Default:_ 50.0
  * **Height (float):** The total height of the cylinder.
    * _Default:_ 100.0
  * **RadialSteps (int32):** Controls the number of segments around the circumference, defining the smoothness of the curve.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 32
  * **HeightSteps (int32):** Controls the number of segments along the cylinder's height, for vertical resolution.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 4
  * **bCapped (bool):** If `True`, the top and bottom faces of the cylinder are closed. If `False`, it forms an open-ended tube.
    * _Default:_ True

### Cone (`UBlockoutShape_Cone`)

A conical primitive, allowing for both true cones and truncated cones (frustums) with different top and base radii. When `bCapped` is false, it generates an inward-facing surface for a hollow cone or frustum.

* **Parameters:**
  * **BaseRadius (float):** The radius of the cone's base.
    * _Default:_ 50.0
  * **TopRadius (float):** The radius of the cone's top. Set to `0.0` for a true cone.
    * _Default:_ 5.0
  * **Height (float):** The total height of the cone.
    * _Default:_ 100.0
  * **RadialSteps (int32):** Controls the number of segments around the circumference.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 32
  * **HeightSteps (int32):** Controls the number of segments along the cone's height.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 4
  * **bCapped (bool):** If `True`, the top and bottom faces of the cone are closed. If `False`, it forms an open-ended cone/frustum.
    * _Default:_ True

### Torus (`UBlockoutShape_Torus`)

A donut or ring-shaped primitive, useful for arches, intricate piping, or decorative elements.

* **Parameters:**
  * **MajorRadius (float):** The radius from the center of the torus to the center of its circular tube.
    * _Default:_ 100.0
  * **MinorRadius (float):** The radius of the circular tube itself.
    * _Default:_ 20.0
  * **MajorSteps (int32):** Controls the number of segments around the main ring of the torus.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 32
  * **MinorSteps (int32):** Controls the number of segments around the cross-section of the torus's tube.
    * _Recommended Range:_ 3 to 128
    * _Default:_ 16
  * **RevolveOptions (FGeometryScriptRevolveOptions):** Advanced options for controlling the generation of the torus, including:
    * `RevolveDegrees`: Defines the arc length of the torus (e.g., 360 for a full ring, 180 for a half-ring).
    * `DegreeOffset`: Shifts the starting point of the revolve.
    * `bFillPartialRevolveEndcaps`: If `RevolveDegrees` is less than 360, this closes the open ends.
    * _Default:_ Full 360-degree revolve with closed endcaps if partial.

### Ramp (`UBlockoutShape_Ramp`)

An inclined plane, perfect for creating sloped surfaces, accessible elevations, or transition points. Its UVs are procedurally generated and box-projected for consistent tiling with blockout materials.

* **Parameters:**
  * **Width (float):** The dimension of the ramp along its shorter axis (typically the cross-section you'd walk across).
    * _Default:_ 100.0
  * **Length (float):** The dimension of the ramp along its longer, sloping axis (the "run" of the ramp).
    * _Default:_ 200.0
  * **Mode (EBlockoutRampMode):** Determines how the ramp's inclination is defined.
    * `ByHeight`: Define the ramp by its total vertical elevation.
    * `ByAngle`: Define the ramp by its angle of inclination.
  * **Height (float):** (Visible when `Mode` is `ByHeight`) The total vertical elevation of the ramp from its base to its highest point.
    * _Default:_ 100.0
  * **Angle (float):** (Visible when `Mode` is `ByAngle`) The angle of the ramp relative to the ground plane, in degrees.
    * _Recommended Range:_ 0.0 to 89.9
    * _Default:_ 30.0

### Stairs (`UBlockoutShape_Stairs`)

A highly customizable staircase, allowing for quick creation of stepped transitions.

* **Parameters:**
  * **NumSteps (int32):** The total number of individual steps in the staircase.
    * _Default:_ 10
  * **Dimensions (FVector):** Defines the overall `X` (Width), `Y` (Length/Run), and `Z` (Height/Rise) dimensions of the entire staircase block. The individual step dimensions are derived from these values.
    * _Default:_ (100, 200, 150) (Width, Length, Height)
  * **bFillBase (bool):** Controls the geometry of the staircase's underside.
    * `True`: Creates a "solid block" staircase, where the space beneath the steps is filled (like a ramp underneath). This is often good for foundational blockouts.
    * `False`: Creates a "cut" staircase, with an open underside where each step hangs freely.

### Room (`UBlockoutShape_Room`)

A powerful shape for rapidly creating hollow, box-shaped rooms with defined wall thickness, floor, and ceiling. Its pivot is automatically adjusted to the base for easy placement on ground planes.

* **Parameters:**
  * **RoomDimensions (FVector):** Defines the **inner, usable dimensions** of the room (Length, Width, Height).
    * _Default:_ (400, 400, 300)
  * **WallThickness (float):** The uniform thickness of all walls, floor, and ceiling. This thickness extends _outwards_ from the `RoomDimensions`.
    * _Default:_ 10.0
  * **bShowFloor (bool):** If `False`, the floor section of the room will be cut out, creating an opening at the bottom.
  * **bShowCeiling (bool):** If `False`, the ceiling section of the room will be cut out, creating an opening at the top.
  * **bShowWallFront (bool):** If `False`, the wall on the positive Y-axis side of the room will be cut out.
  * **bShowWallBack (bool):** If `False`, the wall on the negative Y-axis side of the room will be cut out.
  * **bShowWallLeft (bool):** If `False`, the wall on the negative X-axis side of the room will be cut out.
  * **bShowWallRight (bool):** If `False`, the wall on the positive X-axis side of the room will be cut out.
