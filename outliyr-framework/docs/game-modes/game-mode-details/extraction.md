# Extraction



#### Players can be looted after death

* Allowing the character mesh to be overlap with the interaction trace when dead, this means interactions are only possible when dead
* Override the death start functions, so the player ragdolls and the equipment of the player isn't hidden. This also handles setting up the looting inventory.
* Give the dead player an Tetris Inventory Component at the time of death, and a sphere collision so that players can get read only access when near by (full access is provided by opening the dead player inventory in the `GA_Interaction_OpenTetrisInventory`  ability.
* Setup the interaction options to make the player open an inventory
* The `Extraction_Hero`, has a custom death ability, this is not a child of the default Lyra Death ability that comes with Lyra. This is so that `death_finish`  isn't called when the ability ends. In extraction there is no concept of finish dying because once a player dies they leave the game mode, and as for the dead pawn, we don't want it to get destroyed since it might be looted.

