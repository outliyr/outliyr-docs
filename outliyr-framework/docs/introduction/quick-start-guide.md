# Quick Start Guide

This guide is designed for users who want to **jump straight into** using the framework. It assumes you've already completed the installation and setup steps. By the end of this guide, you will:

* &#x20;Understand the project structure
* Set up your own Game Feature Plugin for customization
* Create a basic **game mode** with a player character
* Test and modify a **shooter setup**
* Explore additional settings

### **Understanding the Project Structure**

Before diving in, let’s quickly cover where everything is located inside the project:

📂 **Content/** → Contains **modified Lyra code** and assets\
📂 **Plugins/** → Contains **all core features** (Shooter Base, Tetris Inventory, True First Person, etc.)\
📂 **Plugins/GameFeatures/** → Your custom **game feature plugins** go here

#### **How Core Plugins Work Together**

* **Shooter Base**  → Handles combat mechanics (weapons, shooting, abilities)
* **True First Person** → Enables immersive FPS mode
* **Tetris Inventory** -> Extends Lyra’s inventory with a grid system
* **Base Lyra Modifications** → Improved inventory, item fragments, team systems

{% hint style="info" %}
**Best Practice:** **Try not modify the core framework code** —instead, extend or override behavior using **Game Feature Plugins**.\
\
If you are trying to extend specific functionality to a core plugin, **if you know what you are doing / have some experience** then you can modify the core plugins directly, but be aware of the changes as you will have to merge changes into new updates.
{% endhint %}

***

### **Creating a Game Feature Plugin for Customization**

**Why?** The framework is modular, and Game Feature Plugins allow you to **extend functionality** independently without breaking the base project.

{% hint style="info" %}
You can follow this [guide](installing-and-setup.md#how-to-create-a-game-feature-plugin), to create a Game Feature Plugin
{% endhint %}

***

### **Setting Up a Basic Shooter Game Mode**

Now that the project is set up, let’s try creating a new simple game mode to test the shooter framework. You can follow an example just to get a feel of how it is, but feel free to create it any way you like.

{% content-ref url="../game-modes/extending-and-customization/creating-new-game-modes/" %}
[creating-new-game-modes](../game-modes/extending-and-customization/creating-new-game-modes/)
{% endcontent-ref %}

***

### **Next Steps: Expanding Your Game**

Once you have a basic game mode set up, you can **expand and refine your game** using the tools provided in the core framework or by creating your own core module if required. The next steps depend on the type of game you're building. Here are some common areas to explore:

### Use the Core Framework Features

This framework provides a modular set of tools to help you create your ideal multiplayer shooter. You can:

* Use **Shooter Base** for combat mechanics (weapons, abilities, recoil, hit detection)
* Use **Tetris Inventory** to add inventory management
* Use **True First Person** to add a full-body immersive FPS experience
* Use **Base Lyra Modifications** for team logic, interaction systems, basic inventory, camera system, etc.

**Want to dive Deeper?** Read the documentation on

<table data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Base Lyra</strong></td><td>Learn more about Lyra and the modifications made</td><td></td><td></td><td><a href="../base-lyra-modified/character/">character</a></td></tr><tr><td><strong>Shooter Base</strong></td><td>Learn more about the shooter mechanics</td><td></td><td></td><td><a href="../core-modules/shooter-base/">shooter-base</a></td></tr><tr><td><strong>Tetris Inventory</strong></td><td>Learn more about the advanced jigsaw inventory</td><td></td><td></td><td><a href="../core-modules/tetris-inventory/">tetris-inventory</a></td></tr><tr><td><strong>True First Person</strong></td><td>Learn more about how true first person is implemented</td><td></td><td></td><td><a href="../core-modules/true-first-person.md">true-first-person.md</a></td></tr></tbody></table>

### Reference Existing Game Modes

If you are unsure where to start, you can look at the provided game modes to see how they implement different mechanics

You can:

* **Copy and Modify an existing game mode** (e.g., tweak Team Deathmatch)
* **Use parts of multiple game modes** (e.g., mix Battle Royale with Loadouts)
* **Build a custom mode from scratch** using modular gameplay features

{% content-ref url="../game-modes/game-mode-details/" %}
[game-mode-details](../game-modes/game-mode-details/)
{% endcontent-ref %}

### Experiment & Iterate

One of the best ways of learning of directly playing with the framework and experimenting with it. Now that your game is running it's time to refine and customize it to match your vision!
