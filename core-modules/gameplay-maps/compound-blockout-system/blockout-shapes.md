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
