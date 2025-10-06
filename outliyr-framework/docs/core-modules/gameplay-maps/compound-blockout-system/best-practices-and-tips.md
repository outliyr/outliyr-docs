# Best Practices & Tips

You now have a solid understanding of how the Compound Blockout tool works. This page covers some higher-level workflows and tips to help you use the tool efficiently, avoid common pitfalls, and create clean, scalable blockouts.

### Workflow & Mindset

**1. Think in Booleans: Add First, Then Subtract**

When blocking out a space, it's often best to start by building the large, solid forms first using **Add** operations. Once you have the overall mass of a building or room, switch to using **Subtract** shapes to carve out doorways, windows, and details. This additive-then-subtractive approach is often faster and more intuitive than trying to build walls piece-by-piece.

**2. The Actor is a Tool, Not the Final Product**

Always remember that the `Compound Blockout Actor` is a temporary, editable object. Your final level should only contain the baked, lightweight `StaticMeshActor`s. Get into the habit of:

* Building with the `Compound Blockout Actor`.
* Baking it to a `Static Mesh`.
* Using the "Convert to Static Mesh" context-menu action to replace it in your level.

This keeps your maps performant and clean.

**3. Use the Right Shape for the Job**

While you can build almost anything with boxes, using the specialized shapes will save you significant time and effort:

* **Need stairs with proper metrics?** Use the `Linear Stairs` or `Curved Stairs` shapes in "Adaptive" mode. It's faster and more accurate than building steps manually.
* **Need a custom floor plan?** Use the `Prism` shape. It's designed for creating complex polygonal footprints.
* **Need a room?** Use the `Room` shape. It's faster and easier to manage than positioning six individual `Box` shapes for walls, a floor, and a ceiling.

### Technical & Performance

**4. Keep Polygon Counts Reasonable**

It can be tempting to set the `RadialSteps` on a Cylinder or the steps on a Sphere to very high values, but remember this is for blockouts. The goal is to define form and space for gameplay. Use the lowest number of steps that effectively communicates the shape. You can always increase the resolution later before a final bake if needed.

**5. Understand Collision**

The default collision setting (`Use Complex As Simple`) is perfect for the blockout phase because it provides exact, per-polygon collision. Be aware that for final, production-ready assets, you may eventually want to create custom, simplified collision meshes for better performance. However, for the entire `Gameplay Maps` design process, the default is your best choice.

**6. Leverage the "Unlinked Bake" for One-Offs**

If you are creating a truly unique piece of geometry, like a custom subtractive cut into a landscape that will never be used anywhere else, consider using the "Bake Unlinked" option. This will create the `Static Mesh` without a corresponding `Recipe`, keeping your `Recipes` folder clean and focused only on reusable, modular assets.

### Organization

**7. Treat the Recipe as Your Source File**

Think of the `CompoundBlockoutAsset` (the Recipe) as the equivalent of a `.blend` or `.max` source file. The `Static Mesh` is the "exported" or "compiled" result. By protecting and organizing your Recipes, you are ensuring that your work is always editable and non-destructive.

**8. Name Your Assets Clearly**

The tool automatically names recipes by appending `_Recipe` to the baked Static Mesh's name. Adopt a clear naming convention for your Static Meshes to make this relationship obvious.

* **Good:** `SM_ModularWall_A` -> `SM_ModularWall_A_Recipe`
* **Good:** `SM_Warehouse_Doorway` -> `SM_Warehouse_Doorway_Recipe`

**9. Use Level Editor Folders for Complex Assemblies**

If you are building a very large structure that requires multiple `Compound Blockout Actors` working together, use the World Outliner's folder system to group them. This keeps your scene organized during the design phase, especially before you bake everything down into its final mesh components.
