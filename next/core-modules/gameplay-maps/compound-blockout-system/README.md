# Compound Blockout System

### Level Blockout in Gameplay Maps

The process of designing effective gameplay spaces begins long before detailed art assets are created. This initial phase, known as **whiteboxing** or **greyboxing**, focuses on defining the spatial layout, flow, and structural elements of a map. Within this framework, the **Compound Blockout System** is your primary tool for this crucial stage.

Its purpose is to facilitate the rapid prototyping and iteration of map environments directly within your `Gameplay Maps`. It provides a flexible, non-destructive way to build placeholder geometry that perfectly aligns with the project's composable and modular design principles.

### Introduction to the Compound Blockout Actor

At the heart of the Compound Blockout System is the **Compound Blockout Actor**. This specialized Unreal Engine actor enables level designers to combine multiple simple geometric shapes, referred to as `Blockout Shapes`, into a single, cohesive mesh.

Think of it as an **in-engine Constructive Solid Geometry (CSG) tool**, similar in concept to tools found in traditional 3D modeling software, but optimized for quick whiteboxing and greyboxing workflows within Unreal Engine.

### Key Features & Benefits

The Compound Blockout System offers significant advantages for level design:

* **Rapid Iteration:** Accelerate your early map design process. Quickly define, visualize, and adjust complex structures like rooms, platforms, ramps, and stairs with immediate feedback in the viewport.
* **Flexibility & Non-Destructive Editing:** Unlike traditional mesh editing that often bakes changes, all aspects of a blockout are parameter-driven. Shapes can be dynamically added, removed, reordered, or modified at any time without destroying previous work, allowing for fluid experimentation.
* **Precise Control:** Utilize numerical inputs for defining dimensions, wall thicknesses, angles, step counts, and other properties. This ensures consistent measurements and scales throughout your blockout, aiding in gameplay balancing and player metric adherence.
* **Clean & Robust Geometry:** Internally, the system leverages advanced boolean operations (CSG) to ensure that all combined shapes result in a single, watertight mesh. This robust approach inherently avoids common rendering issues like Z-fighting and ensures a solid base for collision and lighting.
* **Single Actor, Reduced Draw Calls:** All individual Blockout Shapes are combined and rendered as a single UDynamicMeshComponent on the Compound Blockout Actor. This significantly **reduces draw calls for that combined structure** compared to using many separate standard mesh actors for each primitive during the blockout phase, helping maintain editor performance in complex layouts.
* **Per-Shape Material Assignment:** Each individual Blockout Shape can have its own MaterialOverride. This allows designers to easily apply different colors or basic textures to distinct parts of their blockout (e.g., walls vs. floor, or different functional areas) for clear visual separation during prototyping. These materials are dynamically assigned to the correct sections of the final combined mesh.

