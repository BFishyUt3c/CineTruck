package com.example.foroservice.Infrastructure.Controllers;

import com.example.foroservice.Application.Services.MessageService;
import com.example.foroservice.Domain.Entities.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {
    private final MessageService messageService;

    @GetMapping("/all")
    public ResponseEntity<Page<Message>> getAllPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(messageService.getAllPaginated(pageable));
    }

    @GetMapping("/thread/{threadId}")
    public ResponseEntity<List<Message>> getByThreadId(@PathVariable String threadId) {
        return ResponseEntity.ok(messageService.getByThreadId(threadId));
    }

    @GetMapping("/thread/{threadId}/paginated")
    public ResponseEntity<Page<Message>> getByThreadIdPaginated(
            @PathVariable String threadId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(messageService.getByThreadIdPaginated(threadId, pageable));
    }

    @PostMapping
    public ResponseEntity<Message> create(@RequestBody Message message) {
        return ResponseEntity.status(HttpStatus.CREATED).body(messageService.create(message));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        messageService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
