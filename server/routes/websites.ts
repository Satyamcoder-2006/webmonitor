import { cleanupWebsiteMonitoring, updateWebsiteMonitoring } from "../monitoring";

// ... existing code ...

// Delete a website
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Clean up monitoring before deleting
    cleanupWebsiteMonitoring(parseInt(id));
    
    await db.execute(sql`
      DELETE FROM websites 
      WHERE id = ${id}
    `);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting website:", error);
    res.status(500).json({ error: "Failed to delete website" });
  }
});

// Update a website
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { url, name, email, check_interval, is_active } = req.body;
    
    const result = await db.execute(sql`
      UPDATE websites 
      SET url = ${url}, 
          name = ${name}, 
          email = ${email}, 
          check_interval = ${check_interval},
          is_active = ${is_active}
      WHERE id = ${id}
      RETURNING *
    `);
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Website not found" });
    }

    // Update monitoring and compression policy
    updateWebsiteMonitoring(result[0]);
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating website:", error);
    res.status(500).json({ error: "Failed to update website" });
  }
});

// ... existing code ... 