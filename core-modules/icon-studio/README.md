# Icon Studio

Icon Studio is an editor tool for authoring an item's icon by hand. It stages meshes or actors in a scene of its own, frames them on screen, and saves what it framed as a texture asset. Open it from **Tools → Outliyr → Icon Studio**.

An item's icon is either an authored texture or a render taken while the game runs, and the [Icon fragment](../../base-lyra-modified/items/item-fragments-in-depth/icon-fragment.md) is where that choice is made. A render always matches the item, down to the scope currently fitted, and costs a capture during play. An authored texture costs nothing at runtime and never changes. Icon Studio is for the second kind: it gives you somewhere to frame and shoot one without building a staging level yourself.

***

### What You Get

| Icon Studio | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| Staging     | Any number of parts, each an actor class, a skeletal mesh or a static mesh |
| Placement   | Transform handles in the viewport, or values typed into the panel      |
| Framing     | Pulls the camera back until everything staged is in view               |
| Background  | The preview environment, a flat colour, or nothing at all              |
| Output      | Size, how far it is oversampled, the content path and the asset name   |
| Coverage    | Taken from depth, so what nothing was drawn over comes out transparent  |

***

### Staging a scene

A scene is a list of entries, drawn in the order they are listed. Each entry names one part, and what it names decides what is placed: an actor class is taken in preference to either mesh, and a skeletal mesh in preference to a static one.

Each part carries its own location, rotation and scale relative to the scene's origin, and a visibility flag. Hiding a part leaves its placement intact, so a variant can be tried and then put back without setting it up again.

> [!WARNING]
> An actor is built but never begins play, so nothing it would do during a match runs here. An actor that only reveals its meshes once play has started therefore stages as nothing, and the mesh has to be named directly instead.

### Placing parts

Parts are placed either by typing values into the panel or by dragging the handles in the viewport, which use the editor's own transform toolbar, so moving, rotating and scaling work the way they do in a level.

A value being dragged in the panel moves the part as the drag happens rather than when it is released. Framing pulls the camera back until everything staged is within view, which is where most icons start before the camera is moved in by hand.

### The background

What sits behind the parts is one of three things:

* **Environment** shows the preview environment and floor. Scenery is the easiest thing to judge a material against, and is there for framing rather than to keep, so the saved texture still carries only what was staged.
* **Solid colour** puts a flat colour behind the parts and keeps it in the saved texture.
* **Transparent** leaves nothing behind the parts at all.

The viewport is masked down to the shape the output size describes, so what is framed on screen is what the texture ends up holding.

### Taking the picture

Exposure is held still in both the viewport and the capture, because a picture taken under a different exposure than the one it was framed under is not the picture that was framed.

The capture is rendered at the oversampling factor times the output size and then reduced to it, which is what keeps the edge of a mesh smooth, since the capture itself has no antialiasing to lean on.

Colour and coverage are gathered separately. What the scene renders carries no usable record of where nothing was drawn, so coverage comes from depth instead, which answers that for anything solid. Translucent parts are left out of the shape that is kept for that reason, so a glass lens reads as empty rather than as a faint shape.

### The saved texture

The texture is created at the content path and name given, then selected in the content browser. It is left unsaved, so the result can be looked at and thrown away rather than written over something by accident.

It is saved with no mipmaps, no streaming and the editor icon compression setting, because an icon keeps its edge only if nothing stretches or blurs it.

When a picture cannot be taken, the reason is reported in a dialog: nothing was staged, the picture could not be read back from the renderer, or the path given is not somewhere a texture can be saved.

> [!INFO]
> The staging scene lives only as long as the tab is open. Closing the tool discards how a picture was set up rather than leaving an asset behind, so a scene is not a recipe that can be reopened and shot again later.

### Using the texture

Point the item's [Icon fragment](../../base-lyra-modified/items/item-fragments-in-depth/icon-fragment.md) at the saved texture with its source set to an authored texture. Nothing in Icon Studio is tied to the item system, so a texture it produces is an ordinary asset and can be used anywhere a texture can.
