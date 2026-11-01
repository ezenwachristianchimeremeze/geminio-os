        <View style={{ gap: 8 }}>
          <Text style={{ color: c.foreground }}>Delete &quot;{target.title}&quot; permanently? All its messages are removed and any share link stops working. This can&apos;t be undone.</Text>
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, { backgroundColor: c.error }]} onPress={() => run(async () => { await del.mutateAsync({ id: target.id }); onDeleted(target.id); onClose(); })}>
            <Text style={{ color: c.errorForeground }}>Delete permanently</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.primary, { backgroundColor: c.surfaceMuted }]} onPress={() => setMode("menu")}><Text style={{ color: c.foreground }}>Keep it</Text></Pressable>
        </View>
